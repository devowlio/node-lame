import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import type { BitWidth, LameOptionsBag, LameProgressEmitter, LameStatus } from "../types";
import { resolveLameBinary } from "../internal/binary/resolve-binary";
import { LameOptions } from "./lame-options";
import {
    buildLameSpawnArgs,
    createInitialStatus,
    spawnLameProcess,
} from "./lame-process";
import type { ProgressKind } from "./lame-process";

function isFloatArray(
    view: ArrayBufferView,
): view is Float32Array | Float64Array {
    return view instanceof Float32Array || view instanceof Float64Array;
}

/**
 * Thin wrapper around the LAME CLI that manages temp files, progress events,
 * and output handling while delegating the heavy lifting to the binary.
 */
class Lame {
    private status: LameStatus = createInitialStatus();

    private readonly emitter: LameProgressEmitter =
        new EventEmitter() as LameProgressEmitter;

    private readonly options: LameOptionsBag;
    private readonly builder: LameOptions;

    private filePath?: string;
    private fileBuffer?: Buffer;
    private fileBufferTempFilePath?: string;

    private progressedFilePath?: string;
    private progressedBuffer?: Buffer;
    private progressedBufferTempFilePath?: string;

    private lamePath: string;
    private tempPath: string;

    constructor(options: LameOptionsBag) {
        if (options.output === "stream") {
            throw new Error(
                "lame: The streaming output mode requires createLameEncoderStream or createLameDecoderStream",
            );
        }

        this.options = options;
        this.builder = new LameOptions(this.options);
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

        let inputPath = this.filePath;

        if (!inputPath && this.fileBuffer) {
            inputPath = await this.persistInputBufferToTempFile(type);
        }

        try {
            return await this.spawnLameAndTrackProgress(inputPath!, type);
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
        type: ProgressKind,
    ): Promise<this> {
        this.status = createInitialStatus();
        const { outputPath, bufferOutput } =
            await this.prepareOutputTarget(type);
        const spawnArgs = buildLameSpawnArgs(
            this.builder,
            type,
            inputFilePath,
            outputPath,
        );

        return new Promise((resolve, reject) => {
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

            spawnLameProcess({
                binaryPath: this.lamePath,
                spawnArgs,
                kind: type,
                status: this.status,
                emitter: this.emitter,
                completeOnTag: true,
                progressSources: ["stdout", "stderr"],
                onError: (error) => {
                    this.emitter.emit("error", error);
                },
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

export { Lame };
export {
    normalizeCliMessage,
    parseDecodeProgressLine,
    parseEncodeProgressLine,
} from "./lame-process";
