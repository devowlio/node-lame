import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ReadableMock = EventEmitter & {
    readableEnded: boolean;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
};

type WritableMock = EventEmitter & {
    destroyed: boolean;
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
};

type MockChildProcess = EventEmitter & {
    stdin: WritableMock;
    stdout: ReadableMock;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
    killed: boolean;
};

const spawnMock = vi.fn();

vi.mock("node:child_process", () => ({
    spawn: (...args: [string, string[]]) => spawnMock(...args),
}));

const createReadableMock = (): ReadableMock => {
    const readable = new EventEmitter() as ReadableMock;
    readable.readableEnded = false;
    readable.pause = vi.fn();
    readable.resume = vi.fn();
    readable.on("end", () => {
        readable.readableEnded = true;
    });
    return readable;
};

const createWritableMock = (): WritableMock => {
    const writable = new EventEmitter() as WritableMock;
    writable.destroyed = false;
    writable.write = vi.fn(() => true);
    writable.end = vi.fn(() => {
        writable.destroyed = true;
    });
    return writable;
};

const createMockProcess = (): MockChildProcess => {
    const process = new EventEmitter() as MockChildProcess;
    process.stdin = createWritableMock();
    process.stdout = createReadableMock();
    process.stderr = new EventEmitter();
    process.kill = vi.fn(() => {
        process.killed = true;
        process.emit("close", 0);
        return true;
    });
    process.killed = false;
    return process;
};

let activeProcess: MockChildProcess | null = null;

const {
    createLameDecoderStream,
    createLameEncoderStream,
} = await import("../../src/core/lame-stream");

beforeEach(() => {
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => {
        const mock = createMockProcess();
        activeProcess = mock;
        return mock;
    });
    activeProcess = null;
});

afterEach(() => {
    activeProcess = null;
});

describe("LameCodecStream", () => {
    it("spawns encoder stream with progress updates", () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });

        const process = activeProcess!;
        const [, args] = spawnMock.mock.calls.at(-1)! as [string, string[]];
        expect(args.slice(0, 2)).toEqual(["-", "-"]);

        const progress: number[] = [];
        stream.getEmitter().on("progress", ([value]) => progress.push(value));
        const finishSpy = vi.fn();
        stream.getEmitter().once("finish", finishSpy);

        process.stderr.emit("data", Buffer.from("( 50%)| 00:01 "));
        process.stdout.emit("end");
        process.emit("close", 0);

        expect(progress.at(-1)).toBe(100);
        expect(stream.getStatus().finished).toBe(true);
        expect(finishSpy).toHaveBeenCalled();
    });

    it("adds decode flag and handles percentage from decode output", () => {
        const stream = createLameDecoderStream({ binaryPath: "/usr/bin/lame" });

        const process = activeProcess!;
        const [, args] = spawnMock.mock.calls.at(-1)! as [string, string[]];
        expect(args).toContain("--decode");

        const progress: number[] = [];
        stream.getEmitter().on("progress", ([value]) => progress.push(value));
        const finishSpy = vi.fn();
        stream.getEmitter().once("finish", finishSpy);

        process.stderr.emit("data", Buffer.from("1/2"));
        process.stderr.emit("data", Buffer.from("2/2"));
        process.stdout.emit("end");
        process.emit("close", 0);

        expect(progress).toContain(100);
        expect(stream.getStatus().finished).toBe(true);
        expect(finishSpy).toHaveBeenCalled();
    });

    it("propagates CLI warnings as errors", () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });

        const process = activeProcess!;
        const errors: Error[] = [];
        stream.on("error", (error) => errors.push(error));

        let thrown: Error | null = null;
        try {
            process.stderr.emit("data", Buffer.from("Warning: corrupted input"));
        } catch (error) {
            thrown = error as Error;
        }

        const observed = errors[0] ?? thrown!;
        expect(observed.message).toContain("corrupted input");
    });

    it("handles backpressure and resolves after drain", async () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;

        process.stdin.write.mockImplementationOnce(() => false);
        stream.on("error", () => {});

        const writePromise = new Promise<void>((resolve, reject) => {
            stream.write(Buffer.from("payload"), (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });

        process.stdin.emit("drain");
        await writePromise;
    });

    it("propagates exit code 255 with descriptive error", () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;

        const errors: Error[] = [];
        stream.on("error", (error) => errors.push(error));

        let thrown: Error | null = null;
        try {
            process.emit("close", 255);
        } catch (error) {
            thrown = error as Error;
        }

        const observed = errors[0] ?? thrown!;
        expect(observed.message).toContain("Unexpected termination");
    });

    it("destroys the child process when manually destroyed", () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;

        stream.destroy();

        expect(process.kill).toHaveBeenCalled();
    });

    it("surfaces errors from stdin.end during finalization", async () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;

        process.stdin.end.mockImplementationOnce(() => {
            throw new Error("cannot end");
        });

        const error = await new Promise<Error>((resolve) => {
        stream.once("error", resolve);
            stream.end(() => {});
        });

        expect(error.message).toBe("cannot end");
    });

    it("resumes stdout consumption after backpressure resolves", () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;

        const pushSpy = vi.spyOn(stream as unknown as { push: CallableFunction }, "push");
        pushSpy.mockReturnValueOnce(false).mockReturnValue(true);

        process.stdout.emit("data", Buffer.from("chunk"));
        expect(process.stdout.pause).toHaveBeenCalled();

        stream.read();
        expect(process.stdout.resume).toHaveBeenCalled();
        pushSpy.mockRestore();
    });

    it("does not resume stdout when the stream is not paused", () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;

        stream.read();
        expect(process.stdout.resume).not.toHaveBeenCalled();
    });

    it("rejects writes once the stream has finished", async () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;

        Object.assign(stream as unknown as { finished: boolean }, { finished: true });
        const emitted: Error[] = [];
        stream.on("error", (error) => emitted.push(error));

        const error = await new Promise<Error>((resolve) => {
            stream.write(Buffer.from("payload"), (err) => resolve(err!));
        });

        expect(error.message).toBe("lame: Stream has already finished");
        expect(emitted[0]).toBe(error);
        expect(process.stdin.write).not.toHaveBeenCalled();
    });

    it("propagates synchronous errors thrown by stdin.write", async () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;

        const boom = new Error("boom");
        process.stdin.write.mockImplementationOnce(() => {
            throw boom;
        });
        const emitted: Error[] = [];
        stream.on("error", (error) => emitted.push(error));

        const error = await new Promise<Error>((resolve) => {
            stream.write(Buffer.from("payload"), (err) => resolve(err!));
        });

        expect(error).toBe(boom);
        expect(emitted[0]).toBe(boom);
    });

    it("surfaces errors emitted while waiting for drain", async () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;
        const expected = new Error("drain failed");

        process.stdin.write.mockImplementationOnce(() => false);
        stream.on("error", () => {});
        stream.getEmitter().on("error", () => {});

        const errorPromise = new Promise<Error>((resolve) => {
            stream.write(Buffer.from("payload"), (err) => resolve(err!));
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(process.stdin.listenerCount("error")).toBeGreaterThan(0);

        let thrown: Error | null = null;
        try {
            process.stdin.emit("error", expected);
        } catch (error) {
            thrown = error as Error;
        }

        const error = await errorPromise;
        expect(error).toBe(expected);
        expect(thrown).toBeNull();
    });

    it("fails writes when stdin closes before draining", async () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;

        process.stdin.write.mockImplementationOnce(() => false);
        stream.on("error", () => {});
        stream.getEmitter().on("error", () => {});

        const errorPromise = new Promise<Error>((resolve) => {
            stream.write(Buffer.from("payload"), (err) => resolve(err!));
        });

        await new Promise((resolve) => setTimeout(resolve, 0));
        process.stdin.emit("close");

        const error = await errorPromise;
        expect(error.message).toBe("lame: Input stream closed before drain");
    });

    it("ends stdin when finalizing without errors", async () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;

        await new Promise<void>((resolve, reject) => {
            stream.end((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });

        expect(process.stdin.end).toHaveBeenCalled();
    });

    it("propagates kill failures during destruction", async () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;
        const killError = new Error("cannot kill");

        process.kill.mockImplementationOnce(() => {
            throw killError;
        });

        const error = await new Promise<Error | null>((resolve) => {
            (
                stream as unknown as {
                    _destroy: (
                        error: Error | null,
                        callback: (error?: Error | null) => void,
                    ) => void;
                }
            )._destroy(null, (err) => {
                resolve(err ?? null);
            });
        });

        expect(error).toBe(killError);
    });

    it("marks status finished and terminates child when emitting stream error", async () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;
        const statusBefore = stream.getStatus();
        const errors: Error[] = [];
        stream.on("error", (error) => errors.push(error));
        stream.getEmitter().on("error", () => {
            /* consume CLI emitter errors */
        });

        process.stderr.emit("data", Buffer.from("Warning: failed"));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(statusBefore.finished).toBe(true);
        expect(process.kill).toHaveBeenCalled();
        expect(errors[0]?.message).toBe("lame: Warning: failed");
    });

    it("cleans up child listeners on successful completion", () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;

        const stdoutRemove = vi.spyOn(process.stdout, "removeAllListeners");
        const stderrRemove = vi.spyOn(process.stderr, "removeAllListeners");
        const stdinRemove = vi.spyOn(process.stdin, "removeAllListeners");
        const processRemove = vi.spyOn(process, "removeAllListeners");

        process.stdout.emit("end");
        process.emit("close", 0);

        expect(stdoutRemove).toHaveBeenCalled();
        expect(stderrRemove).toHaveBeenCalled();
        expect(stdinRemove).toHaveBeenCalled();
        expect(processRemove).toHaveBeenCalled();
        expect(stream.getStatus().started).toBe(true);
    });

    it("propagates stdout errors through the stream", () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;
        const errors: Error[] = [];
        stream.getEmitter().on("error", (error) => errors.push(error));
        stream.on("error", () => {});

        process.stdout.emit("error", new Error("stdout failed"));

        expect(errors[0]?.message).toBe("stdout failed");
        expect(process.kill).toHaveBeenCalled();
    });

    it("propagates stderr errors through the stream", () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;
        const errors: Error[] = [];
        stream.getEmitter().on("error", (error) => errors.push(error));
        stream.on("error", () => {});

        process.stderr.emit("error", new Error("stderr failed"));

        expect(errors[0]?.message).toBe("stderr failed");
        expect(process.kill).toHaveBeenCalled();
    });

    it("writes without backpressure when stdin accepts the chunk", async () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });

        await new Promise<void>((resolve, reject) => {
            stream.write(Buffer.from("ok"), (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    });

    it("skips forwarding stdout once an error has occurred", () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const pushSpy = vi.spyOn(stream as unknown as { push: CallableFunction }, "push");
        pushSpy.mockReturnValue(true);

        Object.assign(stream as unknown as { hasErrored: boolean }, { hasErrored: true });
        (stream as unknown as { forwardStdout: (chunk: Buffer) => void }).forwardStdout(
            Buffer.from("content"),
        );

        expect(pushSpy).not.toHaveBeenCalled();
        pushSpy.mockRestore();
    });

    it("avoids pausing stdout when push succeeds", () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;
        const pushSpy = vi.spyOn(stream as unknown as { push: CallableFunction }, "push");
        pushSpy.mockReturnValue(true);

        process.stdout.emit("data", Buffer.from("chunk"));

        expect(process.stdout.pause).not.toHaveBeenCalled();
        pushSpy.mockRestore();
    });

    it("skips killing the child when it was already terminated", () => {
        const stream = createLameEncoderStream({ binaryPath: "/usr/bin/lame" });
        const process = activeProcess!;
        process.killed = true;
        process.kill.mockClear();

        stream.getEmitter().on("error", () => {});
        stream.on("error", () => {});
        process.stdout.emit("error", new Error("already done"));

        expect(process.kill).not.toHaveBeenCalled();
    });
});
