import { LameStatus, Options } from "./LameTypings";
import { LameOptions } from "./LameOptions";
import {
    existsSync as fsExistsSync,
    readFile as fsReadFile,
    writeFile as fsWriteFile,
    unlinkSync as fsUnlinkSync
} from "fs";
import { spawn } from "child_process";
import { EventEmitter } from "events";

/**
 * Wrapper for Lame for Node
 *
 * @class Lame
 */
class Lame {
    private status: LameStatus = {
        started: false,
        finished: false,
        progress: undefined,
        eta: undefined
    };
    private emitter: EventEmitter = new EventEmitter();

    private options: Options;
    private args: string[];

    private filePath: string;
    private fileBuffer: Buffer;
    private fileBufferTempFilePath: string;

    private progressedFilePath: string;
    private progressedBuffer: Buffer;
    private progressedBufferTempFilePath: string;

    /**
     * Creates an instance of Lame and set all options
     * @param {Options} options
     */
    constructor(options: Options) {
        this.options = options;
        this.args = new LameOptions(this.options).getArguments();
    }

    /**
     * Set file path of audio to decode/encode
     *
     * @param {string} filePath
     */
    public setFile(path: string): Lame {
        if (!fsExistsSync(path)) {
            throw new Error("Audio file (path) does not exist");
        }

        this.filePath = path;
        this.fileBuffer = undefined;

        return this;
    }

    /**
     * Set file buffer of audio to decode/encode
     *
     * @param {Buffer} file
     */
    public setBuffer(file: Buffer): Lame {
        if (!Buffer.isBuffer(file)) {
            throw new Error("Audio file (buffer) dose not exist");
        }

        this.fileBuffer = file;
        this.filePath = undefined;

        return this;
    }

    /**
     * Get decoded/encoded file path
     *
     * @returns {string} Path of decoded/encoded file
     */
    public getFile(): string {
        if (this.progressedFilePath == undefined) {
            throw new Error("Audio is not yet decoded/encoded");
        }

        return this.progressedFilePath;
    }

    /**
     * Get decoded/encoded file as buffer
     *
     * @returns {Buffer} decoded/Encoded file
     */
    public getBuffer(): Buffer {
        if (this.progressedBuffer == undefined) {
            throw new Error("Audio is not yet decoded/encoded");
        }

        return this.progressedBuffer;
    }

    /**
     * Get event emitter
     *
     * @returns {EventEmitter}
     */
    public getEmitter(): EventEmitter {
        return this.emitter;
    }

    /**
     * Get status of converter
     *
     * @returns {LameStatus}
     */
    public getStatus(): LameStatus {
        return this.status;
    }

    /**
     * Encode audio file by Lame
     *
     * @return {Promise}
     */
    public encode(): Promise<boolean> {
        return this.progress("encode");
    }

    /**
     * Decode audio file by Lame
     *
     * @return {Promise}
     */
    public decode(): Promise<boolean> {
        return this.progress("decode");
    }

    /**
     * Decode/Encode audio file by Lame
     *
     * @return {Promise}
     */
    private progress(type: "encode" | "decode"): Promise<any> {
        if (this.filePath == undefined && this.fileBuffer == undefined) {
            throw new Error("Audio file to encode is not set");
        }

        // Set decode flag to progress a MP3 to WAV decode
        const args = this.args;
        if (type == "decode") {
            args.push("--decode");
        }

        if (this.fileBuffer != undefined) {
            // File buffer is set; write it as temp file
            this.fileBufferTempFilePath = this.tempFilePathGenerator(
                "raw",
                type
            );

            return new Promise((resolve, reject) => {
                fsWriteFile(
                    this.fileBufferTempFilePath,
                    this.fileBuffer,
                    err => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        resolve(this.fileBufferTempFilePath);
                    }
                );
            })
                .then((file: string) => {
                    return this.execProgress(file, args, type);
                })
                .catch((error: Error) => {
                    this.removeTempFilesOnError();
                    throw error;
                });
        } else {
            // File path is set
            return this.execProgress(this.filePath, args, type).catch(
                (error: Error) => {
                    this.removeTempFilesOnError();
                    throw error;
                }
            );
        }
    }

    /**
     * Execute decoding/encoding via spawn Lame
     *
     * @private
     * @param {string} inputFilePath Path of input file
     */
    private execProgress(
        inputFilePath: string,
        args: string[],
        type: "encode" | "decode"
    ) {
        // Add output settings args
        args.push("--disptime");
        args.push("1");

        // Add output file to args, if not undefined in options
        if (this.options.output == "buffer") {
            const tempOutPath = this.tempFilePathGenerator("encoded", type);
            args.unshift(`${tempOutPath}`);

            // Set decode/encoded file path
            this.progressedBufferTempFilePath = tempOutPath;
        } else {
            // Set decode/encoded file path
            this.progressedFilePath = this.options.output;
            args.unshift(this.progressedFilePath);
        }

        // Add input file to args
        args.unshift(inputFilePath);

        // Spawn instance of encoder and hook output methods
        this.status.started = true;
        this.status.finished = false;
        this.status.progress = 0;
        this.status.eta = undefined;

        /**
         * Handles output of stdout (and stderr)
         * Parses data from output into object
         *
         * @param {(String | Buffer)} data
         */
        const progressStdout = (data: String | Buffer) => {
            data = data.toString().trim();

            // Every output of Lame comes as "stderr". Deciding if it is an error or valid data by regex
            if (data.length > 6) {
                if (
                    type == "encode" &&
                    data.search("Writing LAME Tag...done") > -1
                ) {
                    // processing done
                    this.status.finished = true;
                    this.status.progress = 100;
                    this.status.eta = "00:00";

                    this.emitter.emit("finish");
                    this.emitter.emit("progress", [
                        this.status.progress,
                        this.status.eta
                    ]);
                } else if (
                    type == "encode" &&
                    data.search(/\((( [0-9])|([0-9]{2})|(100))%\)\|/) > -1
                ) {
                    // status of processing
                    const progressMatch = data.match(
                        /\((( [0-9])|([0-9]{2})|(100))%\)\|/
                    );
                    const etaMatch = data.match(/[0-9]{1,2}:[0-9][0-9] /);

                    const progress: string = String(progressMatch[1]);
                    let eta: string = null;
                    if (etaMatch != null) {
                        eta = etaMatch[0].trim();
                    }

                    if (
                        progress != null &&
                        Number(progress) > this.status.progress
                    ) {
                        this.status.progress = Number(progress);
                    }

                    if (eta != null) {
                        this.status.eta = eta;
                    }

                    this.emitter.emit("progress", [
                        this.status.progress,
                        this.status.eta
                    ]);
                } else if (
                    type == "decode" &&
                    data.search(/[0-9]{1,10}\/[0-9]{1,10}/) > -1
                ) {
                    const progressMatch = data.match(
                        /[0-9]{1,10}\/[0-9]{1,10}/
                    );
                    const progressAbsolute = progressMatch[0].split("/");
                    const progress = Math.floor(
                        (Number(progressAbsolute[0]) /
                            Number(progressAbsolute[1])) *
                            100
                    );

                    if (
                        !isNaN(progress) &&
                        Number(progress) > this.status.progress
                    ) {
                        this.status.progress = Number(progress);
                    }

                    this.emitter.emit("progress", [
                        this.status.progress,
                        this.status.eta
                    ]);
                } else if (
                    data.search(/^lame: /) > -1 ||
                    data.search(/^Warning: /) > -1 ||
                    data.search(/Error /) > -1
                ) {
                    // Unexpected output => error
                    if (data.search(/^lame: /) == -1) {
                        this.emitter.emit("error", new Error("lame: " + data));
                    } else {
                        this.emitter.emit("error", new Error(String(data)));
                    }
                }
            }
        };

        const progressOnClose = code => {
            if (code == 0) {
                if (!this.status.finished) {
                    this.emitter.emit("finish");
                }

                this.status.finished = true;
                this.status.progress = 100;
                this.status.eta = "00:00";
            }

            if (code === 255) {
                this.emitter.emit("error", new Error("Unexpected termination of the process, possibly directly after the start. Please check if the input and/or output does not exist."));
            }
        };

        /**
         * Handles error throw of Lame instance
         *
         * @param {Error} error
         */
        const progressError = (error: Error) => {
            this.emitter.emit("error", error);
        };

        const instance = spawn("lame", args);
        instance.stdout.on("data", progressStdout);
        instance.stderr.on("data", progressStdout); // Most output, even non-errors, are on stderr
        instance.on("close", progressOnClose);
        instance.on("error", progressError);

        // Return promise of finish encoding progress
        return new Promise((resolve, reject) => {
            this.emitter.on("finish", () => {
                // If input was buffer, remove temp file
                if (this.fileBufferTempFilePath != undefined) {
                    fsUnlinkSync(this.fileBufferTempFilePath);
                }

                // If output should be a buffer, load decoded/encoded audio file in object and remove temp file
                if (this.options.output == "buffer") {
                    fsReadFile(
                        this.progressedBufferTempFilePath,
                        null,
                        (error, data: string) => {
                            // Remove temp decoded/encoded file
                            fsUnlinkSync(this.progressedBufferTempFilePath);

                            if (error) {
                                reject(error);
                                return;
                            }

                            this.progressedBuffer = Buffer.from(data);
                            this.progressedBufferTempFilePath = undefined;

                            resolve(this);
                        }
                    );
                } else {
                    resolve(this);
                }
            });

            this.emitter.on("error", error => {
                reject(error);
            });
        });
    }

    /**
     * Generate temp file path
     *
     * @param {("raw" | "encoded")} type
     * @returns {string} Path
     */
    private tempFilePathGenerator(
        type: "raw" | "encoded",
        progressType: "encode" | "decode"
    ): string {
        const prefix = `${__dirname}/../.`;
        let path = `${prefix}./temp/${type}/`;
        let possible =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for (let i = 0; i < 32; i++) {
            path += possible.charAt(
                Math.floor(Math.random() * possible.length)
            );
        }

        if (type == "raw" && progressType == "decode") {
            path += `.mp3`;
        }

        if (!fsExistsSync(`${prefix}./temp/${path}`)) {
            return path;
        } else {
            return this.tempFilePathGenerator(type, progressType);
        }
    }

    /**
     * Remove temp files, if error occurred
     */
    private removeTempFilesOnError() {
        if (this.fileBufferTempFilePath != undefined && fsExistsSync(this.fileBufferTempFilePath)) {
            fsUnlinkSync(this.fileBufferTempFilePath);
        }

        if (this.progressedBufferTempFilePath != undefined && fsExistsSync(this.progressedBufferTempFilePath)) {
            fsUnlinkSync(this.progressedBufferTempFilePath);
        }
    }
}

export { Lame };
