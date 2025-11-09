/* global BufferEncoding */

import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import { Duplex } from "node:stream";

import type {
    LameOptionsBag,
    LameProgressEmitter,
    LameStatus,
    LameStreamMode,
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

type LameStreamConfig = Omit<LameStreamOptions, "output"> & {
    binaryPath?: string;
};

class LameStream extends Duplex {
    private readonly emitter: LameProgressEmitter;
    private readonly status: LameStatus;
    private readonly builder: LameOptions;
    private readonly binaryPath?: string;
    private readonly kind: StreamKind;

    private child?: ChildProcessWithoutNullStreams;

    private isStdoutPaused = false;
    private hasErrored = false;
    private finished = false;

    constructor(options: LameStreamConfig) {
        super({ allowHalfOpen: false });

        const { binaryPath, mode, ...cliOptions } = options;
        if (!isValidStreamMode(mode)) {
            throw new Error(
                'lame: LameStream requires a mode of either "encode" or "decode"',
            );
        }

        const normalizedOptions: LameOptionsBag = {
            ...(cliOptions as Omit<LameStreamOptions, "output" | "mode">),
            output: "stream",
        } as LameOptionsBag;

        this.binaryPath = binaryPath;
        this.status = createInitialStatus();
        this.emitter = new EventEmitter() as LameProgressEmitter;
        this.builder = new LameOptions(normalizedOptions);
        this.kind = mode;

        this.initialize(this.kind);
    }

    public getEmitter(): LameProgressEmitter {
        return this.emitter;
    }

    public getStatus(): LameStatus {
        return this.status;
    }

    public override _read(): void {
        if (!this.child) {
            return;
        }

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
        const child = this.child;
        if (!child) {
            callback(new Error("lame: Stream mode is not initialized yet"));
            return;
        }

        if (this.finished || child.stdin.destroyed) {
            callback(new Error("lame: Stream has already finished"));
            return;
        }

        try {
            const flushed = child.stdin.write(chunk, encoding);
            if (!flushed) {
                const cleanup = () => {
                    child.stdin.off("drain", onDrain);
                    child.stdin.off("error", onError);
                    child.stdin.off("close", onClose);
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

                child.stdin.once("drain", onDrain);
                child.stdin.once("error", onError);
                child.stdin.once("close", onClose);
                return;
            }
        } catch (error) {
            callback(error as Error);
            return;
        }

        callback();
    }

    public override _final(callback: (error?: Error | null) => void): void {
        const child = this.child;
        if (!child) {
            callback(new Error("lame: Stream mode is not initialized yet"));
            return;
        }

        try {
            child.stdin.end();
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
        const child = this.child;

        if (!child) {
            callback(error ?? null);
            return;
        }

        try {
            if (!child.killed) {
                child.kill();
            }
        } catch (killError) {
            callback(killError as Error);
            return;
        }

        this.cleanupChildListeners();
        callback(error ?? null);
    }

    private initialize(kind: StreamKind): void {
        if (this.child) {
            return;
        }

        const spawnArgs = buildLameSpawnArgs(this.builder, kind, "-", "-");

        this.child = spawnLameProcess({
            binaryPath: this.binaryPath,
            spawnArgs,
            kind,
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

    private forwardStdout(chunk: Buffer) {
        if (this.hasErrored || this.finished) {
            return;
        }

        const shouldContinue = this.push(chunk);
        if (!shouldContinue && this.child) {
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
            if (this.child && !this.child.killed) {
                this.child.kill();
            }
        } catch {
            /* ignore termination errors while cleaning up */
        }

        super.destroy(error);
    }

    private cleanupChildListeners() {
        if (!this.child) {
            return;
        }

        this.child.stdout.removeAllListeners();
        this.child.stderr.removeAllListeners();
        this.child.stdin.removeAllListeners();
        this.child.removeAllListeners();
    }
}

const isValidStreamMode = (value: unknown): value is LameStreamMode => {
    return value === "encode" || value === "decode";
};

export { LameStream };
export type { LameStreamConfig };
