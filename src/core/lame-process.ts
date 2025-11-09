import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { ProcessEnv } from "node:process";
import { delimiter } from "node:path";

import type {
    LameProgressEmitter,
    LameStatus,
    LameStreamMode,
} from "../types";
import {
    resolveBundledLibraryDirectory,
    resolveLameBinary,
} from "../internal/binary/resolve-binary";
import { LameOptions } from "./lame-options";

type ProgressKind = LameStreamMode;

const LAME_TAG_MESSAGE = "Writing LAME Tag...done";

function createInitialStatus(): LameStatus {
    return {
        started: false,
        finished: false,
        progress: 0,
        eta: undefined,
    };
}

function buildLameSpawnArgs(
    builder: LameOptions,
    kind: ProgressKind,
    input: string,
    output: string,
): string[] {
    const args = builder.getArguments();
    const normalizedArgs = [...args];

    if (
        builder.shouldUseDefaultDisptime() &&
        !normalizedArgs.includes("--disptime")
    ) {
        normalizedArgs.push("--disptime", "1");
    }

    if (kind === "decode") {
        normalizedArgs.push("--decode");
    }

    return [input, output, ...normalizedArgs.map((value) => String(value))];
}

function markProcessFinished(
    status: LameStatus,
    emitter: LameProgressEmitter,
) {
    if (status.finished) {
        return;
    }

    status.finished = true;
    status.progress = 100;
    status.eta = "00:00";

    emitter.emit("finish");
    emitter.emit("progress", [status.progress, status.eta]);
}

function parseEncodeProgressLine(content: string): {
    progress?: number;
    eta?: string;
} | null {
    const progressMatch = content.match(/\(\s*((?:[0-9]{1,2})|100)%\)\|/);
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

interface ProgressProcessorOptions {
    kind: ProgressKind;
    status: LameStatus;
    emitter: LameProgressEmitter;
    completeOnTag?: boolean;
}

interface ProgressProcessorResult {
    error?: Error;
}

function processProgressChunk(
    payload: Buffer,
    options: ProgressProcessorOptions,
): ProgressProcessorResult {
    const { kind, status, emitter, completeOnTag } = options;
    const content = payload.toString();
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line === "") {
            continue;
        }

        if (completeOnTag && line.includes(LAME_TAG_MESSAGE)) {
            markProcessFinished(status, emitter);
            continue;
        }

        if (kind === "encode") {
            const parsed = parseEncodeProgressLine(line);
            if (parsed) {
                if (
                    parsed.progress !== undefined &&
                    parsed.progress > status.progress
                ) {
                    status.progress = parsed.progress;
                }

                if (parsed.eta) {
                    status.eta = parsed.eta;
                }

                emitter.emit("progress", [status.progress, status.eta]);
                continue;
            }
        } else {
            const parsed = parseDecodeProgressLine(line);
            if (parsed !== null) {
                if (!Number.isNaN(parsed)) {
                    status.progress = parsed;
                }

                emitter.emit("progress", [status.progress, status.eta]);
                continue;
            }
        }

        const normalized = normalizeCliMessage(line);
        if (normalized) {
            return { error: new Error(normalized) };
        }
    }

    return {};
}

function getExitError(
    code: number | null,
    executable: string,
): Error | null {
    if (code === 0) {
        return null;
    }

    if (code === 255) {
        return new Error(
            "Unexpected termination of the process, possibly directly after the start. Please check if the input and/or output does not exist.",
        );
    }

    if (code === 127) {
        return new Error(
            `lame: Failed to execute '${executable}'. Exit code 127 usually indicates missing shared libraries or an unreadable binary. Run scripts/diagnose-lame.mjs for details.`,
        );
    }

    if (code !== null) {
        return new Error(`lame: Process exited with code ${code}`);
    }

    return new Error("lame: Process exited unexpectedly");
}

function applyBundledLibraryPath(
    env: ProcessEnv,
    libraryDir: string | null,
): ProcessEnv {
    if (!libraryDir) {
        return env;
    }

    let variable: "LD_LIBRARY_PATH" | "DYLD_LIBRARY_PATH" | "PATH" | null =
        null;

    if (process.platform === "linux") {
        variable = "LD_LIBRARY_PATH";
    } else if (process.platform === "darwin") {
        variable = "DYLD_LIBRARY_PATH";
    } else if (process.platform === "win32") {
        variable = "PATH";
    }

    if (!variable) {
        return env;
    }

    const currentValue = env[variable];
    return {
        ...env,
        [variable]: currentValue
            ? `${libraryDir}${delimiter}${currentValue}`
            : libraryDir,
    };
}

interface SpawnLameProcessOptions {
    binaryPath?: string;
    spawnArgs: string[];
    kind: ProgressKind;
    status: LameStatus;
    emitter: LameProgressEmitter;
    onError: (error: Error) => void;
    progressSources: Array<"stdout" | "stderr">;
    completeOnTag?: boolean;
    onStdoutData?: (chunk: Buffer) => void;
    onStdoutEnd?: () => void;
    onStdoutError?: (error: Error) => void;
    onStderrData?: (chunk: Buffer) => void;
    onStderrError?: (error: Error) => void;
    onStdinError?: (error: Error) => void;
    onSuccess?: () => void;
}

function spawnLameProcess(
    options: SpawnLameProcessOptions,
): ChildProcessWithoutNullStreams {
    const {
        binaryPath,
        spawnArgs,
        kind,
        status,
        emitter,
        onError,
        progressSources,
        completeOnTag,
        onStdoutData,
        onStdoutEnd,
        onStdoutError,
        onStderrData,
        onStderrError,
        onStdinError,
        onSuccess,
    } = options;

    status.started = true;
    status.finished = false;
    status.progress = 0;
    status.eta = undefined;

    const executable = binaryPath ?? resolveLameBinary();
    const libraryDir = resolveBundledLibraryDirectory();
    const childEnv = applyBundledLibraryPath({ ...process.env }, libraryDir);
    const child = spawn(executable, spawnArgs, {
        env: childEnv,
    });

    const progressTargets = new Set(progressSources);
    let hasSeenCliError = false;
    let stderrBuffer = "";

    const deliveredErrorMessages = new Set<string>();

    const deliverError = (error: Error) => {
        const message = error.message ?? String(error);
        if (deliveredErrorMessages.has(message)) {
            return;
        }

        deliveredErrorMessages.add(message);
        onError(error);
    };

    const emitCliError = (error: Error) => {
        hasSeenCliError = true;
        deliverError(error);
    };

    const emitExitError = (error: Error) => {
        if (hasSeenCliError) {
            return;
        }

        deliverError(error);
    };

    const handleStdout = (chunk: Buffer) => {
        if (progressTargets.has("stdout")) {
            const { error } = processProgressChunk(chunk, {
                kind,
                status,
                emitter,
                completeOnTag,
            });

            if (error) {
                emitCliError(error);
                return;
            }
        }

        onStdoutData?.(chunk);
    };

    const handleStderr = (chunk: Buffer) => {
        stderrBuffer += chunk.toString();
        if (progressTargets.has("stderr")) {
            const { error } = processProgressChunk(chunk, {
                kind,
                status,
                emitter,
                completeOnTag,
            });

            if (error) {
                emitCliError(error);
                return;
            }
        }

        onStderrData?.(chunk);
    };

    child.stdout.on("data", handleStdout);
    child.stderr.on("data", handleStderr);

    if (onStdoutEnd) {
        child.stdout.on("end", onStdoutEnd);
    }

    child.stdout.on("error", (error) => {
        onStdoutError?.(error);
        emitCliError(error);
    });

    child.stderr.on("error", (error) => {
        onStderrError?.(error);
        emitCliError(error);
    });

    child.stdin.on("error", (error) => {
        onStdinError?.(error);
        emitCliError(error);
    });

    child.on("error", emitCliError);
    child.on("close", (code) => {
        const exitError = getExitError(code, executable);
        if (exitError) {
            const bufferedLines = stderrBuffer
                .split(/\r?\n/)
                .map((value) => value.trim())
                .filter((value) => value.length > 0);

            for (const line of bufferedLines) {
                const normalized = normalizeCliMessage(line);
                if (normalized) {
                    emitCliError(new Error(normalized));
                    return;
                }
            }

            emitExitError(exitError);
            return;
        }

        markProcessFinished(status, emitter);
        onSuccess?.();
    });

    return child;
}

export {
    buildLameSpawnArgs,
    createInitialStatus,
    getExitError,
    markProcessFinished,
    normalizeCliMessage,
    parseDecodeProgressLine,
    parseEncodeProgressLine,
    processProgressChunk,
    spawnLameProcess,
};
export type { ProgressKind, SpawnLameProcessOptions };
