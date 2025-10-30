import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LameProgressEmitter } from "../../src/types";

type MockChildProcess = EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: EventEmitter & {
        write: ReturnType<typeof vi.fn>;
    };
    kill: ReturnType<typeof vi.fn>;
    killed: boolean;
};

const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
    spawn: (...args: [string, string[]]) => spawnMock(...args),
}));

const createMockChildProcess = (): MockChildProcess => {
    const child = new EventEmitter() as MockChildProcess;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    const stdin = new EventEmitter() as MockChildProcess["stdin"];
    stdin.write = vi.fn(() => true);
    child.stdin = stdin;
    child.kill = vi.fn(() => {
        child.killed = true;
        return true;
    });
    child.killed = false;
    return child;
};

beforeEach(() => {
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => {
        const child = createMockChildProcess();
        return child;
    });
});

const {
    buildLameSpawnArgs,
    createInitialStatus,
    parseEncodeProgressLine,
    processProgressChunk,
    getExitError,
    spawnLameProcess,
} = await import("../../src/core/lame-process");
const binaryModule = await import("../../src/internal/binary/resolve-binary");
const { LameOptions } = await import("../../src/core/lame-options");

describe("buildLameSpawnArgs", () => {
    it("adds default disptime and decode flag when required", () => {
        const builder = new LameOptions({ output: "buffer", bitrate: 128 });

        const args = buildLameSpawnArgs(
            builder,
            "decode",
            "input.raw",
            "output.wav",
        );

        expect(args.slice(0, 2)).toEqual(["input.raw", "output.wav"]);
        expect(args).toContain("--disptime");
        expect(args).toContain("1");
        expect(args).toContain("--decode");
    });

    it("preserves explicit disptime configuration", () => {
        const builder = new LameOptions({
            output: "buffer",
            bitrate: 128,
            disptime: 5,
        });

        const args = buildLameSpawnArgs(
            builder,
            "encode",
            "input.raw",
            "output.mp3",
        );

        const occurrences = args.filter((value) => value === "--disptime")
            .length;
        expect(occurrences).toBe(1);
        expect(args).toContain("5");
        expect(args).not.toContain("--decode");
    });
});

describe("processProgressChunk", () => {
    const createEmitter = () => new EventEmitter() as LameProgressEmitter;

    it("tracks encode progress and marks completion on LAME tag message", () => {
        const status = createInitialStatus();
        const emitter = createEmitter();
        emitter.on("progress", () => {
            /* track progress emission */
        });
        let finished = false;
        emitter.once("finish", () => {
            finished = true;
        });

        const payload = Buffer.from("( 40%)| 00:05 ");
        expect(parseEncodeProgressLine("( 40%)| 00:05 ")).toEqual({
            progress: 40,
            eta: "00:05",
        });
        const { error } = processProgressChunk(payload, {
            kind: "encode",
            status,
            emitter,
            completeOnTag: true,
        });

        expect(error).toBeUndefined();
        expect(status.progress).toBe(40);
        expect(status.finished).toBe(false);

        processProgressChunk(Buffer.from("Writing LAME Tag...done"), {
            kind: "encode",
            status,
            emitter,
            completeOnTag: true,
        });

        expect(finished).toBe(true);
        expect(status.finished).toBe(true);
        expect(status.progress).toBe(100);
    });

    it("updates decode progress percentages", () => {
        const status = createInitialStatus();
        const emitter = createEmitter();
        const payload = Buffer.from("25/50");

        processProgressChunk(payload, {
            kind: "decode",
            status,
            emitter,
        });

        expect(status.progress).toBe(50);
    });

    it("returns cli warnings as errors", () => {
        const status = createInitialStatus();
        const emitter = createEmitter();

        const { error } = processProgressChunk(
            Buffer.from("Warning: something happened"),
            {
                kind: "encode",
                status,
                emitter,
            },
        );

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toContain("something happened");
    });

    it("ignores blank lines in progress payloads", () => {
        const status = createInitialStatus();
        const emitter = createEmitter();
        const spy = vi.fn();
        emitter.on("progress", spy);

        const { error } = processProgressChunk(Buffer.from("  \n\n "), {
            kind: "encode",
            status,
            emitter,
        });

        expect(error).toBeUndefined();
        expect(spy).not.toHaveBeenCalled();
        expect(status.progress).toBe(0);
    });
});

describe("getExitError", () => {
    it("returns null for successful exit", () => {
        expect(getExitError(0)).toBeNull();
    });

    it("returns descriptive error for exit code 255", () => {
        const error = getExitError(255);
        expect(error?.message).toContain("Unexpected termination of the process");
    });

    it("returns error for other exit codes", () => {
        const error = getExitError(3);
        expect(error?.message).toBe("lame: Process exited with code 3");
    });

    it("handles null exit codes", () => {
        const error = getExitError(null);
        expect(error?.message).toBe("lame: Process exited unexpectedly");
    });
});

describe("spawnLameProcess", () => {
    it("emits progress and completion events on successful exit", () => {
        const status = createInitialStatus();
        const emitter = new EventEmitter() as LameProgressEmitter;
        const errors: Error[] = [];
        const successSpy = vi.fn();
        const progress: number[] = [];

        emitter.on("progress", ([value]) => progress.push(value));

        const child = spawnLameProcess({
            binaryPath: "/usr/bin/lame",
            spawnArgs: ["input.raw", "output.mp3"],
            kind: "encode",
            status,
            emitter,
            progressSources: ["stdout"],
            completeOnTag: true,
            onError: (error) => errors.push(error),
            onSuccess: successSpy,
        });

        expect(status.started).toBe(true);

        child.stdout.emit("data", Buffer.from("( 60%)| 00:02 "));
        child.stdout.emit("data", Buffer.from("Writing LAME Tag...done"));
        child.emit("close", 0);

        expect(progress.at(-1)).toBe(100);
        expect(status.finished).toBe(true);
        expect(successSpy).toHaveBeenCalled();
        expect(errors).toEqual([]);
    });

    it("invokes error handler when the process exits with a failure code", () => {
        const status = createInitialStatus();
        const emitter = new EventEmitter() as LameProgressEmitter;
        const errors: Error[] = [];

        const child = spawnLameProcess({
            binaryPath: "/usr/bin/lame",
            spawnArgs: ["input.raw", "output.mp3"],
            kind: "encode",
            status,
            emitter,
            progressSources: [],
            onError: (error) => errors.push(error),
        });

        child.emit("close", 1);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toContain("code 1");
        expect(status.finished).toBe(false);
    });

    it("only reports the first CLI error emitted by the process", () => {
        const status = createInitialStatus();
        const emitter = new EventEmitter() as LameProgressEmitter;
        const errors: Error[] = [];

        const child = spawnLameProcess({
            binaryPath: "/usr/bin/lame",
            spawnArgs: ["input.raw", "output.mp3"],
            kind: "encode",
            status,
            emitter,
            progressSources: ["stderr"],
            onError: (error) => errors.push(error),
        });

        child.stderr.emit("data", Buffer.from("Error simulated failure\n"));
        child.emit("close", 1);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toContain("Error simulated failure");
    });

    it("does not forward exit errors when a CLI error already occurred", () => {
        const status = createInitialStatus();
        const emitter = new EventEmitter() as LameProgressEmitter;
        const errors: Error[] = [];

        const child = spawnLameProcess({
            binaryPath: "/usr/bin/lame",
            spawnArgs: ["input.raw", "output.mp3"],
            kind: "encode",
            status,
            emitter,
            progressSources: [],
            onError: (error) => errors.push(error),
        });

        const cliError = new Error("from cli");
        child.emit("error", cliError);
        child.emit("close", 2);

        expect(errors).toHaveLength(1);
        expect(errors[0]).toBe(cliError);
    });

    it("propagates stdout chunk errors from progress parsing", () => {
        const status = createInitialStatus();
        const emitter = new EventEmitter() as LameProgressEmitter;
        const errors: Error[] = [];

        const child = spawnLameProcess({
            binaryPath: "/usr/bin/lame",
            spawnArgs: ["input.raw", "output.mp3"],
            kind: "encode",
            status,
            emitter,
            progressSources: ["stdout"],
            onError: (error) => errors.push(error),
        });

        child.stdout.emit("data", Buffer.from("Warning: broken"));
        child.stdout.emit("data", Buffer.from("Warning: broken"));

        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe("lame: Warning: broken");
    });

    it("forwards stdio errors to the error handler", () => {
        const status = createInitialStatus();
        const emitter = new EventEmitter() as LameProgressEmitter;
        const errors: Error[] = [];

        const child = spawnLameProcess({
            binaryPath: "/usr/bin/lame",
            spawnArgs: ["input.raw", "output.mp3"],
            kind: "encode",
            status,
            emitter,
            progressSources: [],
            onError: (error) => errors.push(error),
        });

        const stdoutError = new Error("stdout");
        const stderrError = new Error("stderr");
        const stdinError = new Error("stdin");

        child.stdout.emit("error", stdoutError);
        child.stderr.emit("error", stderrError);
        child.stdin.emit("error", stdinError);

        expect(errors).toEqual([stdoutError, stderrError, stdinError]);
    });

    it("forwards stdout chunks when configured", () => {
        const status = createInitialStatus();
        const emitter = new EventEmitter() as LameProgressEmitter;
        const stdoutSpy = vi.fn();

        const child = spawnLameProcess({
            binaryPath: "/usr/bin/lame",
            spawnArgs: ["input.raw", "output.mp3"],
            kind: "encode",
            status,
            emitter,
            progressSources: [],
            onError: vi.fn(),
            onStdoutData: stdoutSpy,
        });

        const chunk = Buffer.from("payload");
        child.stdout.emit("data", chunk);

        expect(stdoutSpy).toHaveBeenCalledWith(chunk);
    });

    it("resolves default binary path when none is provided", () => {
        const status = createInitialStatus();
        const emitter = new EventEmitter() as LameProgressEmitter;
        const errors: Error[] = [];

        const resolveSpy = vi.spyOn(binaryModule, "resolveLameBinary");
        resolveSpy.mockReturnValue("/resolved/lame");

        spawnLameProcess({
            spawnArgs: ["input.raw", "output.mp3"],
            kind: "encode",
            status,
            emitter,
            progressSources: [],
            onError: (error) => errors.push(error),
        });

        expect(resolveSpy).toHaveBeenCalled();
        expect(spawnMock).toHaveBeenCalledWith("/resolved/lame", [
            "input.raw",
            "output.mp3",
        ]);
        expect(errors).toEqual([]);
        resolveSpy.mockRestore();
    });

    it("processes stderr progress updates when configured", () => {
        const status = createInitialStatus();
        const emitter = new EventEmitter() as LameProgressEmitter;
        const progress: number[] = [];

        emitter.on("progress", ([value]) => progress.push(value));

        const child = spawnLameProcess({
            binaryPath: "/usr/bin/lame",
            spawnArgs: ["input.raw", "output.mp3"],
            kind: "decode",
            status,
            emitter,
            progressSources: ["stderr"],
            onError: vi.fn(),
        });

        child.stderr.emit("data", Buffer.from("3/4"));

        expect(progress).toContain(75);
    });

    it("emits normalized buffered CLI errors on close", () => {
        const status = createInitialStatus();
        const emitter = new EventEmitter() as LameProgressEmitter;
        const errors: Error[] = [];

        const child = spawnLameProcess({
            binaryPath: "/usr/bin/lame",
            spawnArgs: ["input.raw", "output.mp3"],
            kind: "encode",
            status,
            emitter,
            progressSources: [],
            onError: (error) => errors.push(error),
        });

        child.stderr.emit("data", Buffer.from("Warning: buffered failure\n"));
        child.emit("close", 1);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe("lame: Warning: buffered failure");
    });

    it("stringifies errors that do not expose a message", () => {
        const status = createInitialStatus();
        const emitter = new EventEmitter() as LameProgressEmitter;
        const errors: Error[] = [];

        const child = spawnLameProcess({
            binaryPath: "/usr/bin/lame",
            spawnArgs: ["input.raw", "output.mp3"],
            kind: "encode",
            status,
            emitter,
            progressSources: [],
            onError: (error) => errors.push(error),
        });

        const customError = {
            message: undefined,
            toString: () => "custom error object",
        } as unknown as Error;

        child.emit("error", customError);
        child.emit("error", customError);

        expect(errors).toHaveLength(1);
        expect(String(errors[0])).toBe("custom error object");
    });

    it("emits exit error when buffered stderr lines do not normalize", () => {
        const status = createInitialStatus();
        const emitter = new EventEmitter() as LameProgressEmitter;
        const errors: Error[] = [];

        const child = spawnLameProcess({
            binaryPath: "/usr/bin/lame",
            spawnArgs: ["input.raw", "output.mp3"],
            kind: "encode",
            status,
            emitter,
            progressSources: [],
            onError: (error) => errors.push(error),
        });

        child.stderr.emit("data", Buffer.from("non matching output\n"));
        child.emit("close", 2);

        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toBe("lame: Process exited with code 2");
    });
});
