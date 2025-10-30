/* global BufferEncoding */

import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { Duplex } from "node:stream";

import type {
    LameOptionsBag,
    LameProgressEmitter,
    LameStatus,
    LameStreamOptions,
} from "../types";
import { LameOptions } from "./lame-options";
import {
    buildLameSpawnArgs,
    createInitialStatus,
    spawnLameProcess,
} from "./lame-process";
import type { ProgressKind } from "./lame-process";

type StreamKind = ProgressKind;

interface LameStreamConfig extends LameStreamOptions {
    binaryPath?: string;
}

class LameCodecStream extends Duplex {
    private readonly emitter: LameProgressEmitter;
    private readonly status: LameStatus;
    private readonly kind: StreamKind;
    private readonly child: ChildProcessWithoutNullStreams;
    private readonly builder: LameOptions;

    private isStdoutPaused = false;
    private hasErrored = false;
    private finished = false;

    constructor(kind: StreamKind, options: LameStreamConfig) {
        super({ allowHalfOpen: false });

        const { binaryPath, ...cliOptions } = options;
        const normalizedOptions: LameOptionsBag = {
            ...(cliOptions as Omit<LameStreamOptions, "output">),
            output: "stream",
        } as LameOptionsBag;

        this.kind = kind;
        this.status = createInitialStatus();
        this.emitter = new EventEmitter() as LameProgressEmitter;
        this.builder = new LameOptions(normalizedOptions);

        const spawnArgs = buildLameSpawnArgs(this.builder, this.kind, "-", "-");

        this.child = spawnLameProcess({
            binaryPath,
            spawnArgs,
            kind: this.kind,
            status: this.status,
            emitter: this.emitter,
            progressSources: ["stderr"],
            completeOnTag: true,
            onError: (error) => this.emitStreamError(error),
            onStdoutData: (chunk) => this.forwardStdout(chunk),
            onStdoutEnd: () => this.push(null),
            onStdoutError: (error) => this.emitStreamError(error),
            onStderrError: (error) => this.emitStreamError(error),
            onStdinError: (error) => this.emitStreamError(error),
            onSuccess: () => this.handleSuccessfulClose(),
        });
    }

    public getEmitter(): LameProgressEmitter {
        return this.emitter;
    }

    public getStatus(): LameStatus {
        return this.status;
    }

    public override _read(): void {
        if (this.isStdoutPaused && !this.child.stdout.readableEnded) {
            this.isStdoutPaused = false;
            this.child.stdout.resume();
        }
    }

    public override _write(
        chunk: Buffer,
        encoding: BufferEncoding,
        callback: (error?: Error | null) => void,
    ): void {
        if (this.finished || this.child.stdin.destroyed) {
            callback(new Error("lame: Stream has already finished"));
            return;
        }

        try {
            const flushed = this.child.stdin.write(chunk, encoding);
            if (!flushed) {
                const cleanup = () => {
                    this.child.stdin.off("drain", onDrain);
                    this.child.stdin.off("error", onError);
                    this.child.stdin.off("close", onClose);
                };

                const onDrain = () => {
                    cleanup();
                    callback();
                };
                const onError = (error: Error) => {
                    cleanup();
                    callback(error);
                };
                const onClose = () => {
                    cleanup();
                    callback(new Error("lame: Input stream closed before drain"));
                };

                this.child.stdin.once("drain", onDrain);
                this.child.stdin.once("error", onError);
                this.child.stdin.once("close", onClose);
                return;
            }
        } catch (error) {
            callback(error as Error);
            return;
        }

        callback();
    }

    public override _final(callback: (error?: Error | null) => void): void {
        try {
            this.child.stdin.end();
        } catch (error) {
            callback(error as Error);
            return;
        }

        callback();
    }

    public override _destroy(
        error: Error | null,
        callback: (error?: Error | null) => void,
    ): void {
        try {
            if (!this.child.killed) {
                this.child.kill();
            }
        } catch (killError) {
            callback(killError as Error);
            return;
        }

        this.cleanupChildListeners();
        callback(error ?? null);
    }

    private forwardStdout(chunk: Buffer) {
        if (this.hasErrored || this.finished) {
            return;
        }

        const shouldContinue = this.push(chunk);
        if (!shouldContinue) {
            this.isStdoutPaused = true;
            this.child.stdout.pause();
        }
    }

    private handleSuccessfulClose() {
        if (this.finished) {
            return;
        }

        this.finished = true;
        this.cleanupChildListeners();
    }

    private emitStreamError(error: Error) {
        if (this.hasErrored) {
            return;
        }

        this.hasErrored = true;
        this.finished = true;
        this.status.finished = true;
        this.cleanupChildListeners();
        this.emitter.emit("error", error);
        try {
            if (!this.child.killed) {
                this.child.kill();
            }
        } catch {
            /* ignore termination errors while cleaning up */
        }

        super.destroy(error);
    }

    private cleanupChildListeners() {
        this.child.stdout.removeAllListeners();
        this.child.stderr.removeAllListeners();
        this.child.stdin.removeAllListeners();
        this.child.removeAllListeners();
    }
}

const createLameEncoderStream = (options: LameStreamConfig) => {
    return new LameCodecStream("encode", options);
};

const createLameDecoderStream = (options: LameStreamConfig) => {
    return new LameCodecStream("decode", options);
};

export {
    LameCodecStream,
    createLameDecoderStream,
    createLameEncoderStream,
};
export type { LameStreamConfig };
