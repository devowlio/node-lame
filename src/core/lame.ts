import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import type { LameOptionsBag, LameProgressEmitter, LameStatus } from "../types";
import { resolveLameBinary } from "../internal/binary/resolve-binary";
import { LameOptions } from "./lame-options";

type ProgressKind = "encode" | "decode";

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
    private readonly args: Array<string | number>;

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
        this.args = new LameOptions(this.options).getArguments();
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

    public setBuffer(file: Buffer): this {
        if (!Buffer.isBuffer(file)) {
            throw new Error("Audio file (buffer) does not exist");
        }

        this.fileBuffer = file;
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
        baseArgs: Array<string | number>,
        type: ProgressKind,
    ): Promise<this> {
        const args = [...baseArgs, "--disptime", "1"].map((value) =>
            String(value),
        );

        const { outputPath, bufferOutput } =
            await this.prepareOutputTarget(type);
        const spawnArgs = [inputFilePath, outputPath, ...args];

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
                } else if (
                    type === "encode" &&
                    /\((( [0-9])|([0-9]{2})|(100))%\)\|/.test(content)
                ) {
                    const progressMatch = content.match(
                        /\((( [0-9])|([0-9]{2})|(100))%\)\|/,
                    );
                    const etaMatch = content.match(/[0-9]{1,2}:[0-9][0-9] /);

                    const progress =
                        progressMatch && progressMatch[1]
                            ? Number(progressMatch[1])
                            : undefined;
                    const eta = etaMatch ? etaMatch[0].trim() : undefined;

                    if (
                        progress !== undefined &&
                        progress > this.status.progress
                    ) {
                        this.status.progress = progress;
                    }

                    if (eta) {
                        this.status.eta = eta;
                    }

                    this.emitter.emit("progress", [
                        this.status.progress,
                        this.status.eta,
                    ]);
                } else if (
                    type === "decode" &&
                    /[0-9]{1,10}\/[0-9]{1,10}/.test(content)
                ) {
                    const progressMatch = content.match(
                        /[0-9]{1,10}\/[0-9]{1,10}/,
                    );

                    if (progressMatch) {
                        const [current, total] = progressMatch[0]
                            .split("/")
                            .map(Number);
                        const progress = Math.floor((current / total) * 100);

                        if (!Number.isNaN(progress)) {
                            this.status.progress = progress;
                        }

                        this.emitter.emit("progress", [
                            this.status.progress,
                            this.status.eta,
                        ]);
                    }
                } else if (
                    content.startsWith("lame: ") ||
                    content.startsWith("Warning: ") ||
                    content.includes("Error ")
                ) {
                    const message = content.startsWith("lame: ")
                        ? content
                        : `lame: ${content}`;
                    this.emitter.emit("error", new Error(message));
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

    private async persistInputBufferToTempFile(
        type: ProgressKind,
    ): Promise<string> {
        const tempPath = await this.generateTempFilePath("raw", type);
        const inputView = Uint8Array.from(this.fileBuffer!);
        await writeFile(tempPath, inputView);
        this.fileBufferTempFilePath = tempPath;
        return tempPath;
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
        if (dir) {
            await mkdir(dir, { recursive: true });
        }
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
