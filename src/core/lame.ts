import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import type {
    BitWidth,
    LameOptionsBag,
    LameProgressEmitter,
    LameStatus,
} from "../types";
import { resolveLameBinary } from "../internal/binary/resolve-binary";
import { LameOptions } from "./lame-options";

type ProgressKind = "encode" | "decode";

function isFloatArray(
    view: ArrayBufferView,
): view is Float32Array | Float64Array {
    return view instanceof Float32Array || view instanceof Float64Array;
}

function parseEncodeProgressLine(content: string): {
    progress?: number;
    eta?: string;
} | null {
    const progressMatch = content.match(/\((( [0-9])|([0-9]{2})|(100))%\)\|/);
    if (!progressMatch) {
        return null;
    }

    const etaMatch = content.match(/[0-9]{1,2}:[0-9][0-9] /);

    /* c8 ignore next */
    const progress = Number(progressMatch[1]);
    const eta = etaMatch ? etaMatch[0].trim() : undefined;

    return { progress, eta };
}

function parseDecodeProgressLine(content: string): number | null {
    const progressMatch = content.match(/[0-9]{1,10}\/[0-9]{1,10}/);
    if (!progressMatch) {
        return null;
    }

    const [current, total] = progressMatch[0].split("/").map(Number);
    if (!Number.isFinite(current) || !Number.isFinite(total) || total === 0) {
        return NaN;
    }

    return Math.floor((current / total) * 100);
}

function normalizeCliMessage(content: string): string | null {
    if (
        content.startsWith("lame: ") ||
        content.startsWith("Warning: ") ||
        content.includes("Error ")
    ) {
        return content.startsWith("lame: ") ? content : `lame: ${content}`;
    }

    return null;
}

/**
 * Thin wrapper around the LAME CLI that manages temp files, progress events,
 * and output handling while delegating the heavy lifting to the binary.
 */
class Lame {
    private status: LameStatus = {
        started: false,
        finished: false,
        progress: 0,
        eta: undefined,
    };

    private readonly emitter: LameProgressEmitter =
        new EventEmitter() as LameProgressEmitter;

    private readonly options: LameOptionsBag;
    private readonly builder: LameOptions;
    private readonly args: string[];

    private filePath?: string;
    private fileBuffer?: Buffer;
    private fileBufferTempFilePath?: string;

    private progressedFilePath?: string;
    private progressedBuffer?: Buffer;
    private progressedBufferTempFilePath?: string;

    private lamePath: string;
    private tempPath: string;

    constructor(options: LameOptionsBag) {
        this.options = options;
        this.builder = new LameOptions(this.options);
        this.args = this.builder.getArguments();
        this.lamePath = resolveLameBinary();
        this.tempPath = join(tmpdir(), "node-lame");
    }

    public setFile(path: string): this {
        if (!existsSync(path)) {
            throw new Error("Audio file (path) does not exist");
        }

        this.filePath = path;
        this.fileBuffer = undefined;

        return this;
    }

    public setBuffer(
        file: Buffer | ArrayBuffer | ArrayBufferView,
    ): this {
        const normalized = this.normalizeInputBuffer(file);

        this.fileBuffer = normalized;
        this.filePath = undefined;

        return this;
    }

    public setLamePath(path: string): this {
        if (typeof path !== "string" || path.trim() === "") {
            throw new Error("Lame path must be a non-empty string");
        }

        this.lamePath = path;

        return this;
    }

    public setTempPath(path: string): this {
        if (typeof path !== "string" || path.trim() === "") {
            throw new Error("Temp path must be a non-empty string");
        }

        this.tempPath = path;

        return this;
    }

    public getFile(): string {
        if (!this.progressedFilePath) {
            throw new Error("Audio is not yet decoded/encoded");
        }

        return this.progressedFilePath;
    }

    public getBuffer(): Buffer {
        if (!this.progressedBuffer) {
            throw new Error("Audio is not yet decoded/encoded");
        }

        return this.progressedBuffer;
    }

    public getEmitter(): LameProgressEmitter {
        return this.emitter;
    }

    public getStatus(): LameStatus {
        return this.status;
    }

    public async encode(): Promise<this> {
        return this.executeConversion("encode");
    }

    public async decode(): Promise<this> {
        return this.executeConversion("decode");
    }

    /**
     * Executes the CLI for the provided conversion type, handling buffers, files,
     * and cleanup in case of errors.
     */
    private async executeConversion(type: ProgressKind): Promise<this> {
        if (!this.filePath && !this.fileBuffer) {
            throw new Error("Audio file to encode is not set");
        }

        const args = [...this.args];
        if (type === "decode") {
            args.push("--decode");
        }

        let inputPath = this.filePath;

        if (!inputPath && this.fileBuffer) {
            inputPath = await this.persistInputBufferToTempFile(type);
        }

        try {
            return await this.spawnLameAndTrackProgress(inputPath!, args, type);
        } catch (error) {
            await this.removeTempArtifacts();
            throw error;
        }
    }

    /**
     * Spawns the LAME process and listens to progress updates, resolving once complete.
     */
    private async spawnLameAndTrackProgress(
        inputFilePath: string,
        baseArgs: string[],
        type: ProgressKind,
    ): Promise<this> {
        const args = [...baseArgs];

        if (
            this.builder.shouldUseDefaultDisptime() &&
            !args.includes("--disptime")
        ) {
            args.push("--disptime", "1");
        }

        const normalizedArgs = args.map((value) => String(value));

        const { outputPath, bufferOutput } =
            await this.prepareOutputTarget(type);
        const spawnArgs = [inputFilePath, outputPath, ...normalizedArgs];

        this.status = {
            started: true,
            finished: false,
            progress: 0,
            eta: undefined,
        };

        return new Promise((resolve, reject) => {
            const progressStdout = (data: Buffer) => {
                const content = data.toString().trim();

                if (content.length <= 6) {
                    return;
                }

                if (
                    type === "encode" &&
                    content.includes("Writing LAME Tag...done")
                ) {
                    this.status.finished = true;
                    this.status.progress = 100;
                    this.status.eta = "00:00";

                    this.emitter.emit("finish");
                    this.emitter.emit("progress", [
                        this.status.progress,
                        this.status.eta,
                    ]);
                } else if (type === "encode") {
                    const parsed = parseEncodeProgressLine(content);
                    if (parsed) {
                        if (
                            parsed.progress !== undefined &&
                            parsed.progress > this.status.progress
                        ) {
                            this.status.progress = parsed.progress;
                        }

                        if (parsed.eta) {
                            this.status.eta = parsed.eta;
                        }

                        this.emitter.emit("progress", [
                            this.status.progress,
                            this.status.eta,
                        ]);
                        return;
                    }
                }

                if (type === "decode") {
                    const parsed = parseDecodeProgressLine(content);
                    if (parsed !== null) {
                        if (!Number.isNaN(parsed)) {
                            this.status.progress = parsed;
                        }

                        this.emitter.emit("progress", [
                            this.status.progress,
                            this.status.eta,
                        ]);
                        return;
                    }
                }

                const normalized = normalizeCliMessage(content);
                if (normalized) {
                    this.emitter.emit("error", new Error(normalized));
                }
            };

            const progressOnClose = (code: number | null) => {
                if (code === 0) {
                    if (!this.status.finished) {
                        this.emitter.emit("finish");
                    }

                    this.status.finished = true;
                    this.status.progress = 100;
                    this.status.eta = "00:00";
                }

                if (code === 255) {
                    this.emitter.emit(
                        "error",
                        new Error(
                            "Unexpected termination of the process, possibly directly after the start. Please check if the input and/or output does not exist.",
                        ),
                    );
                }
            };

            const progressError = (error: Error) => {
                this.emitter.emit("error", error);
            };

            const instance = spawn(this.lamePath, spawnArgs);
            instance.stdout.on("data", progressStdout);
            instance.stderr.on("data", progressStdout);
            instance.on("close", progressOnClose);
            instance.on("error", progressError);

            const cleanup = async () => {
                if (this.fileBufferTempFilePath) {
                    await unlink(this.fileBufferTempFilePath).catch(() => {});
                    this.fileBufferTempFilePath = undefined;
                }
            };

            this.emitter.once("finish", () => {
                cleanup()
                    .then(async () => {
                        if (bufferOutput && this.progressedBufferTempFilePath) {
                            const buffer = await readFile(
                                this.progressedBufferTempFilePath,
                            );
                            await unlink(
                                this.progressedBufferTempFilePath,
                            ).catch(() => {});

                            if (!Buffer.isBuffer(buffer)) {
                                throw new Error(
                                    "Unexpected output format received from temporary file",
                                );
                            }

                            this.progressedBuffer = buffer;
                            this.progressedBufferTempFilePath = undefined;
                        }

                        resolve(this);
                    })
                    .catch(reject);
            });

            this.emitter.once("error", (error) => {
                cleanup()
                    .then(() => reject(error))
                    .catch(reject);
            });
        });
    }

    private normalizeInputBuffer(
        input: Buffer | ArrayBuffer | ArrayBufferView,
    ): Buffer {
        if (Buffer.isBuffer(input)) {
            return input;
        }

        if (input instanceof ArrayBuffer) {
            return Buffer.from(new Uint8Array(input));
        }

        if (ArrayBuffer.isView(input)) {
            return this.convertArrayViewToBuffer(input);
        }

        throw new Error("Audio file (buffer) does not exist");
    }

    private convertArrayViewToBuffer(view: ArrayBufferView): Buffer {
        if (isFloatArray(view)) {
            return this.convertFloatArrayToBuffer(view);
        }

        const uintView = new Uint8Array(
            view.buffer,
            view.byteOffset,
            view.byteLength,
        );

        return Buffer.from(uintView);
    }

    private convertFloatArrayToBuffer(
        view: Float32Array | Float64Array,
    ): Buffer {
        const bitwidth: BitWidth = this.options.bitwidth ?? 16;
        const useBigEndian = this.shouldUseBigEndian();
        const isSigned = this.isSignedForBitwidth(bitwidth);

        switch (bitwidth) {
            case 8: {
                const buffer = Buffer.alloc(view.length);

                for (let index = 0; index < view.length; index += 1) {
                    const sample = view[index];

                    if (isSigned) {
                        const value = this.scaleToSignedInteger(sample, 8);
                        buffer.writeInt8(value, index);
                    } else {
                        const value = this.scaleToUnsignedInteger(sample, 8);
                        buffer.writeUInt8(value, index);
                    }
                }

                return buffer;
            }

            case 16: {
                if (!isSigned) {
                    throw new Error(
                        "lame: Float PCM input only supports signed samples for bitwidth 16",
                    );
                }

                const buffer = Buffer.alloc(view.length * 2);
                for (let index = 0; index < view.length; index += 1) {
                    const value = this.scaleToSignedInteger(view[index], 16);
                    const offset = index * 2;

                    if (useBigEndian) {
                        buffer.writeInt16BE(value, offset);
                    } else {
                        buffer.writeInt16LE(value, offset);
                    }
                }

                return buffer;
            }

            case 24: {
                if (!isSigned) {
                    throw new Error(
                        "lame: Float PCM input only supports signed samples for bitwidth 24",
                    );
                }

                const buffer = Buffer.alloc(view.length * 3);
                for (let index = 0; index < view.length; index += 1) {
                    const offset = index * 3;
                    const scaled = this.scaleToSignedInteger(view[index], 24);
                    let value = scaled;

                    if (value < 0) {
                        value += 1 << 24;
                    }

                    if (useBigEndian) {
                        buffer[offset] = (value >> 16) & 0xff;
                        buffer[offset + 1] = (value >> 8) & 0xff;
                        buffer[offset + 2] = value & 0xff;
                    } else {
                        buffer[offset] = value & 0xff;
                        buffer[offset + 1] = (value >> 8) & 0xff;
                        buffer[offset + 2] = (value >> 16) & 0xff;
                    }
                }

                return buffer;
            }

            case 32: {
                if (!isSigned) {
                    throw new Error(
                        "lame: Float PCM input only supports signed samples for bitwidth 32",
                    );
                }

                const buffer = Buffer.alloc(view.length * 4);
                for (let index = 0; index < view.length; index += 1) {
                    const value = this.scaleToSignedInteger(view[index], 32);
                    const offset = index * 4;

                    if (useBigEndian) {
                        buffer.writeInt32BE(value, offset);
                    } else {
                        buffer.writeInt32LE(value, offset);
                    }
                }

                return buffer;
            }
        }
    }

    private shouldUseBigEndian(): boolean {
        if (this.options["big-endian"] === true) {
            return true;
        }

        if (this.options["little-endian"] === true) {
            return false;
        }

        return false;
    }

    private isSignedForBitwidth(bitwidth: BitWidth): boolean {
        if (bitwidth === 8) {
            if (this.options.unsigned === true) {
                return false;
            }

            return this.options.signed === true;
        }

        if (this.options.unsigned === true) {
            return false;
        }

        return true;
    }

    private clampSample(value: number): number {
        if (!Number.isFinite(value)) {
            return 0;
        }

        if (value <= -1) {
            return -1;
        }

        if (value >= 1) {
            return 1;
        }

        return value;
    }

    private scaleToSignedInteger(value: number, bitwidth: BitWidth): number {
        const clamped = this.clampSample(value);

        const positiveMax = Math.pow(2, bitwidth - 1) - 1;
        const negativeScale = Math.pow(2, bitwidth - 1);

        if (clamped <= -1) {
            return -negativeScale;
        }

        if (clamped >= 1) {
            return positiveMax;
        }

        if (clamped < 0) {
            const scaled = Math.round(clamped * negativeScale);
            return Math.max(-negativeScale, scaled);
        }

        const scaled = Math.round(clamped * positiveMax);
        return Math.min(positiveMax, scaled);
    }

    private scaleToUnsignedInteger(value: number, bitwidth: BitWidth): number {
        const clamped = this.clampSample(value);
        const normalized = (clamped + 1) / 2;
        const max = Math.pow(2, bitwidth) - 1;
        const scaled = Math.round(normalized * max);

        return Math.min(Math.max(scaled, 0), max);
    }

    private async persistInputBufferToTempFile(
        type: ProgressKind,
    ): Promise<string> {
        const tempPath = await this.generateTempFilePath("raw", type);
        await writeFile(tempPath, this.toUint8Array(this.fileBuffer!));
        this.fileBufferTempFilePath = tempPath;
        return tempPath;
    }

    private toUint8Array(view: Buffer | ArrayBufferView): Uint8Array {
        if (view instanceof Buffer) {
            return new Uint8Array(
                view.buffer,
                view.byteOffset,
                view.byteLength,
            );
        }

        return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }

    private async prepareOutputTarget(type: ProgressKind): Promise<{
        outputPath: string;
        bufferOutput: boolean;
    }> {
        if (this.options.output === "buffer") {
            const tempOutPath = await this.generateTempFilePath(
                "encoded",
                type,
            );
            this.progressedBufferTempFilePath = tempOutPath;

            return { outputPath: tempOutPath, bufferOutput: true };
        }

        this.progressedFilePath = this.options.output as string;
        await this.ensureOutputDirectoryExists(this.progressedFilePath);

        return {
            outputPath: this.progressedFilePath,
            bufferOutput: false,
        };
    }

    private async ensureOutputDirectoryExists(filePath: string) {
        const dir = dirname(filePath);
        if (!dir || dir === ".") {
            return;
        }

        await mkdir(dir, { recursive: true });
    }

    private async generateTempFilePath(
        type: "raw" | "encoded",
        progressType: ProgressKind,
    ): Promise<string> {
        const dir = join(this.tempPath, type);
        await mkdir(dir, { recursive: true });

        const token = randomBytes(16).toString("hex");
        const extension =
            type === "raw" && progressType === "decode" ? ".mp3" : "";

        return join(dir, `${token}${extension}`);
    }

    private async removeTempArtifacts() {
        if (this.fileBufferTempFilePath) {
            await unlink(this.fileBufferTempFilePath).catch(() => {});
            this.fileBufferTempFilePath = undefined;
        }

        if (this.progressedBufferTempFilePath) {
            await unlink(this.progressedBufferTempFilePath).catch(() => {});
            this.progressedBufferTempFilePath = undefined;
        }
    }
}

export {
    Lame,
    normalizeCliMessage,
    parseDecodeProgressLine,
    parseEncodeProgressLine,
};
