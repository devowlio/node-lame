import { EventEmitter } from "node:events";
import * as fsPromises from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

type WritableMock = EventEmitter & {
    destroyed: boolean;
    write: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
};

type MockChildProcess = EventEmitter & {
    stdin: WritableMock;
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
};

const spawnMock = vi.fn();

type SpawnArgs = [command: string, args: string[]];

let spawnBehavior: ((proc: MockChildProcess, args: string[]) => void) | null;

const writeFileBuffer = (path: string, content: Buffer) => {
    return fsPromises.writeFile(path, Uint8Array.from(content));
};

vi.mock("node:child_process", () => ({
    spawn: (...args: SpawnArgs) => spawnMock(...args),
}));

type LameModule = typeof import("../../src/core/lame");
type LameCtor = LameModule["Lame"];

const {
    Lame,
    parseDecodeProgressLine,
    parseEncodeProgressLine,
    normalizeCliMessage,
} = await import("../../src/core/lame");

type LameInstance = InstanceType<LameCtor>;
type LameOptionOverrides = Partial<ConstructorParameters<LameCtor>[0]>;
type SetBufferInput = Parameters<LameInstance["setBuffer"]>[0];

const capturePcmInput = async (
    options: LameOptionOverrides,
    input: SetBufferInput,
) => {
    let captured: Buffer | undefined;

    spawnBehavior = (proc, args) => {
        setTimeout(async () => {
            const [inputPath, outputPath] = args;
            captured = await fsPromises.readFile(inputPath);
            await writeFileBuffer(outputPath, Buffer.from("encoded"));
            proc.stdout.emit(
                "data",
                Buffer.from("Writing LAME Tag...done"),
            );
            proc.emit("close", 0);
        }, 5);
    };

    const encoder = new Lame({
        output: "buffer",
        bitrate: 128,
        raw: true,
        ...options,
    });

    encoder.setBuffer(input);
    await encoder.encode();

    if (!captured) {
        throw new Error("Expected PCM payload to be captured");
    }

    return captured;
};

describe("Lame", () => {
    const tempDirs: string[] = [];

    beforeEach(() => {
        spawnMock.mockReset();
        spawnBehavior = (proc, args) => {
            setTimeout(() => {
                const outputPath = args[1];
                if (outputPath) {
                    writeFileBuffer(outputPath, Buffer.from("encoded"))
                        .then(() => {
                            proc.stdout.emit(
                                "data",
                                Buffer.from("Writing LAME Tag...done"),
                            );
                            proc.emit("close", 0);
                        })
                        .catch(() => {
                            proc.emit("close", 1);
                        });
                } else {
                    proc.emit("close", 1);
                }
            }, 5);
        };

        spawnMock.mockImplementation((command: string, args: string[]) => {
            const process = new EventEmitter() as MockChildProcess;
            const stdin = new EventEmitter() as WritableMock;
            stdin.destroyed = false;
            stdin.write = vi.fn(() => true);
            stdin.end = vi.fn(() => {
                stdin.destroyed = true;
            });
            process.stdin = stdin;
            process.stdout = new EventEmitter();
            process.stderr = new EventEmitter();
            process.kill = vi.fn();

            spawnBehavior?.(process, args);

            return process;
        });
    });

    afterEach(async () => {
        spawnBehavior = null;
        await Promise.all(
            tempDirs.map((dir) =>
                fsPromises.rm(dir, { recursive: true, force: true }),
            ),
        );
        tempDirs.length = 0;
    });

    const createTempDir = async () => {
        const dir = await fsPromises.mkdtemp(join(tmpdir(), "node-lame-test-"));
        tempDirs.push(dir);
        return dir;
    };

    const createTempFile = async (content: Buffer) => {
        const dir = await createTempDir();
        const file = join(dir, "input.raw");
        await writeFileBuffer(file, content);
        return file;
    };

    it("encodes buffers and returns the resulting buffer", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("input"));

        await encoder.encode();

        expect(spawnMock).toHaveBeenCalled();
        expect(encoder.getBuffer()).toBeInstanceOf(Buffer);
        expect(encoder.getStatus().finished).toBe(true);
    });

    it("rejects stream output mode in the Lame class", () => {
        expect(
            () =>
                new Lame({
                    output: "stream",
                } as unknown as any),
        ).toThrow(
            "lame: The streaming output mode requires createLameEncoderStream or createLameDecoderStream",
        );
    });

    it("honours custom disptime option", async () => {
        const encoder = new Lame({
            output: "buffer",
            bitrate: 128,
            disptime: 5,
        });
        encoder.setBuffer(Buffer.from("input"));

        await encoder.encode();

        const [, args] = spawnMock.mock.calls[0] as SpawnArgs;
        expect(args).toContain("--disptime");
        expect(args).toContain("5");
    });

    it("omits default disptime when disabled", async () => {
        const encoder = new Lame({
            output: "buffer",
            bitrate: 128,
            disptime: false,
        });
        encoder.setBuffer(Buffer.from("input"));

        await encoder.encode();

        const [, args] = spawnMock.mock.calls[0] as SpawnArgs;
        expect(args).not.toContain("--disptime");
    });

    it("emits finish when the CLI reports completion", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("input"));

        let finishCalled = false;
        encoder.getEmitter().once("finish", () => {
            finishCalled = true;
        });

        spawnBehavior = (process, args) => {
            setTimeout(async () => {
                const outputPath = args[1];
                await writeFileBuffer(outputPath, Buffer.from("encoded"));
                process.stdout.emit(
                    "data",
                    Buffer.from("Writing LAME Tag...done"),
                );
                process.emit("close", 0);
            }, 5);
        };

        await encoder.encode();
        expect(finishCalled).toBe(true);
        expect(encoder.getStatus().progress).toBe(100);
    });

    it("decodes files and emits progress updates", async () => {
        const tempFile = await createTempFile(Buffer.from("input"));
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setFile(tempFile);

        const progress: number[] = [];
        encoder.getEmitter().on("progress", ([value]) => progress.push(value));

        spawnBehavior = (process, args) => {
            setTimeout(async () => {
                const outputPath = args[1];
                await writeFileBuffer(outputPath, Buffer.from("decoded"));
                process.stderr.emit("data", Buffer.from("Frame 1/10"));
                process.stderr.emit("data", Buffer.from("Frame 10/10"));
                process.emit("close", 0);
            }, 5);
        };

        await encoder.decode();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(progress).not.toHaveLength(0);
        expect(progress[0]).toBeGreaterThan(0);
        expect(encoder.getBuffer()).toBeInstanceOf(Buffer);
        expect(encoder.getStatus().finished).toBe(true);
    });

    it("tracks encode progress percentages", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("input"));

        const statuses: Array<[number, string?]> = [];
        encoder.getEmitter().on("progress", (payload) => {
            statuses.push([payload[0], payload[1]]);
        });

        spawnBehavior = (process, args) => {
            setTimeout(async () => {
                const outputPath = args[1];
                await writeFileBuffer(outputPath, Buffer.from("encoded"));
                process.stderr.emit(
                    "data",
                    Buffer.from("Frame (50%)| 00:20 remaining"),
                );
                process.stderr.emit(
                    "data",
                    Buffer.from("Frame (100%)| 00:00 "),
                );
                process.emit("close", 0);
            }, 5);
        };

        await encoder.encode();
        expect(statuses.some(([progressValue]) => progressValue >= 50)).toBe(
            true,
        );
        expect(encoder.getStatus().eta).toBe("00:00");
    });

    it("does not decrease encode progress when percentage regresses", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("input"));

        const progressValues: number[] = [];
        encoder.getEmitter().on("progress", ([progress]) => {
            progressValues.push(progress);
        });

        spawnBehavior = (process, args) => {
            setTimeout(async () => {
                const outputPath = args[1];
                await writeFileBuffer(outputPath, Buffer.from("encoded"));
                process.stderr.emit(
                    "data",
                    Buffer.from("Frame (60%)| 00:20 "),
                );
                process.stderr.emit(
                    "data",
                    Buffer.from("Frame (40%)| 00:18 "),
                );
                process.stdout.emit(
                    "data",
                    Buffer.from("Writing LAME Tag...done"),
                );
                process.emit("close", 0);
            }, 5);
        };

        await encoder.encode();
        expect(progressValues).toContain(60);
        expect(progressValues[0]).toBe(60);
        expect(progressValues.some((value) => value < 60)).toBe(false);
        expect(progressValues.filter((value) => value === 60).length).toBeGreaterThanOrEqual(2);
        expect(encoder.getStatus().progress).toBe(100);
    });

    it("throws when no input is set", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        await expect(encoder.encode()).rejects.toThrow(
            "Audio file to encode is not set",
        );
    });

    it("validates file paths", () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        expect(() => encoder.setFile("/non/existent")).toThrow(
            "Audio file (path) does not exist",
        );
    });

    it("validates buffer input type", () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        expect(() => encoder.setBuffer("invalid" as unknown as Buffer)).toThrow(
            "Audio file (buffer) does not exist",
        );
    });

    it("accepts Float32Array input and normalizes samples", async () => {
        const floatSamples = new Float32Array([-1, -0.5, 0, 0.5, 1]);
        const pcm = await capturePcmInput({ }, floatSamples);
        expect(pcm.length).toBe(floatSamples.length * 2);
        expect(pcm.readInt16LE(0)).toBe(-32768);
        expect(pcm.readInt16LE(2)).toBe(-16384);
        expect(pcm.readInt16LE(4)).toBe(0);
        expect(pcm.readInt16LE(6)).toBe(16384);
        expect(pcm.readInt16LE(8)).toBe(32767);
    });

    it("converts Float32Array to signed 8-bit PCM", async () => {
        const pcm = await capturePcmInput(
            { bitwidth: 8, signed: true },
            new Float32Array([-1, -0.5, 0, 0.5, 1]),
        );

        expect(pcm.length).toBe(5);
        expect(pcm.readInt8(0)).toBe(-128);
        expect(pcm.readInt8(1)).toBe(-64);
        expect(pcm.readInt8(2)).toBe(0);
        expect(pcm.readInt8(3)).toBe(64);
        expect(pcm.readInt8(4)).toBe(127);
    });

    it("converts Float32Array to unsigned 8-bit PCM and clamps extremes", async () => {
        const pcm = await capturePcmInput(
            { bitwidth: 8, unsigned: true },
            new Float32Array([-2, -1, -0.25, 0, 0.25, 1, 3, Number.NaN]),
        );

        expect([...pcm]).toEqual([0, 0, 96, 128, 159, 255, 255, 128]);
    });

    it("converts Float32Array to big-endian 16-bit PCM", async () => {
        const pcm = await capturePcmInput(
            { bitwidth: 16, signed: true, "big-endian": true },
            new Float32Array([-2, -0.25, 0, 0.25, 2, Infinity]),
        );

        expect(pcm.length).toBe(12);
        expect(pcm.readInt16BE(0)).toBe(-32768);
        expect(pcm.readInt16BE(2)).toBe(-8192);
        expect(pcm.readInt16BE(4)).toBe(0);
        expect(pcm.readInt16BE(6)).toBe(8192);
        expect(pcm.readInt16BE(8)).toBe(32767);
        expect(pcm.readInt16BE(10)).toBe(0);
    });

    it("converts Float32Array to 24-bit little-endian PCM", async () => {
        const pcm = await capturePcmInput(
            { bitwidth: 24, signed: true, "little-endian": true },
            new Float32Array([-1, 0.5]),
        );

        expect(pcm.length).toBe(6);
        expect(pcm[0]).toBe(0x00);
        expect(pcm[1]).toBe(0x00);
        expect(pcm[2]).toBe(0x80);
        expect(pcm[3]).toBe(0x00);
        expect(pcm[4]).toBe(0x00);
        expect(pcm[5]).toBe(0x40);
    });

    it("converts Float32Array to 24-bit big-endian PCM", async () => {
        const pcm = await capturePcmInput(
            { bitwidth: 24, signed: true, "big-endian": true },
            new Float32Array([-1, 0.5]),
        );

        expect(pcm.length).toBe(6);
        expect(pcm[0]).toBe(0x80);
        expect(pcm[1]).toBe(0x00);
        expect(pcm[2]).toBe(0x00);
        expect(pcm[3]).toBe(0x40);
        expect(pcm[4]).toBe(0x00);
        expect(pcm[5]).toBe(0x00);
    });

    it("converts Float32Array to 32-bit big-endian PCM", async () => {
        const pcm = await capturePcmInput(
            { bitwidth: 32, signed: true, "big-endian": true },
            new Float32Array([-1, 0.5, 1]),
        );

        expect(pcm.length).toBe(12);
        expect(pcm.readInt32BE(0)).toBe(-2147483648);
        expect(pcm.readInt32BE(4)).toBe(1073741824);
        expect(pcm.readInt32BE(8)).toBe(2147483647);
    });

    it("converts Float32Array to 32-bit little-endian PCM", async () => {
        const pcm = await capturePcmInput(
            { bitwidth: 32, signed: true, "little-endian": true },
            new Float32Array([-1, 0.5, 1]),
        );

        expect(pcm.length).toBe(12);
        expect(pcm.readInt32LE(0)).toBe(-2147483648);
        expect(pcm.readInt32LE(4)).toBe(1073741824);
        expect(pcm.readInt32LE(8)).toBe(2147483647);
    });

    it("preserves non-float typed array PCM input", async () => {
        const pcm = await capturePcmInput(
            { bitwidth: 16, signed: true, "little-endian": true },
            new Uint16Array([0x0000, 0x7fff]),
        );

        expect(pcm.length).toBe(4);
        expect(pcm.readUInt16LE(0)).toBe(0x0000);
        expect(pcm.readUInt16LE(2)).toBe(0x7fff);
    });

    it("throws when converting float input with unsigned wide bitwidth", () => {
        const encoder = new Lame({
            output: "buffer",
            bitrate: 128,
            raw: true,
            bitwidth: 16,
            unsigned: true,
        });

        expect(() => encoder.setBuffer(new Float32Array([0]))).toThrow(
            "lame: Float PCM input only supports signed samples for bitwidth 16",
        );
    });

    it("converts ArrayBuffer input into buffer", async () => {
        const arrayBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
        const encoder = new Lame({ output: "buffer", bitrate: 128 });

        encoder.setBuffer(arrayBuffer);
        spawnBehavior = (proc, args) => {
            setTimeout(async () => {
                await writeFileBuffer(args[1], Buffer.from("encoded"));
                proc.stdout.emit(
                    "data",
                    Buffer.from("Writing LAME Tag...done"),
                );
                proc.emit("close", 0);
            }, 5);
        };

        await encoder.encode();
        expect(encoder.getStatus().finished).toBe(true);
    });

    it("exposes toUint8Array conversions for non-Buffer views", () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        const toUint8Array = (encoder as unknown as {
            toUint8Array(view: DataView): Uint8Array;
        }).toUint8Array;

        const buffer = new ArrayBuffer(4);
        const view = new DataView(buffer);
        view.setUint32(0, 0x12345678);

        expect([...toUint8Array(view)]).toEqual([...new Uint8Array(buffer)]);
    });

    it("throws when converting float input to 24-bit unsigned PCM", () => {
        const encoder = new Lame({
            output: "buffer",
            bitrate: 128,
            raw: true,
            bitwidth: 24,
            unsigned: true,
        });

        expect(() => encoder.setBuffer(new Float32Array([0]))).toThrow(
            "lame: Float PCM input only supports signed samples for bitwidth 24",
        );
    });

    it("throws when converting float input to 32-bit unsigned PCM", () => {
        const encoder = new Lame({
            output: "buffer",
            bitrate: 128,
            raw: true,
            bitwidth: 32,
            unsigned: true,
        });

        expect(() => encoder.setBuffer(new Float32Array([0]))).toThrow(
            "lame: Float PCM input only supports signed samples for bitwidth 32",
        );
    });


    it("validates LAME path and temp path setters", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        expect(() => encoder.setLamePath("")).toThrow(
            "Lame path must be a non-empty string",
        );
        expect(() => encoder.setTempPath("   ")).toThrow(
            "Temp path must be a non-empty string",
        );

        const customTemp = await createTempDir();
        encoder.setTempPath(customTemp);
        encoder.setBuffer(Buffer.from("input"));
        await encoder.encode();

        const tempSubdirs = await fsPromises.readdir(customTemp);
        expect(tempSubdirs).toContain("raw");
        expect(tempSubdirs).toContain("encoded");
    });

    it("accepts valid custom LAME path strings", () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        const result = encoder.setLamePath("/tmp/custom-lame");
        expect(result).toBe(encoder);
    });

    it("cleans up temporary artifacts on failures", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        const customTemp = await createTempDir();
        encoder.setTempPath(customTemp);
        encoder.setBuffer(Buffer.from("input"));

        spawnBehavior = (process) => {
            setTimeout(() => {
                process.emit("error", new Error("spawn failure"));
            }, 5);
        };

        await expect(encoder.encode()).rejects.toThrow("spawn failure");

        const rawDir = join(customTemp, "raw");
        let rawEntries: string[] = [];
        try {
            rawEntries = await fsPromises.readdir(rawDir);
        } catch (error) {
            const code = (error as { code?: string } | undefined)?.code;
            if (code !== "ENOENT") {
                throw error;
            }
        }

        expect(rawEntries).toHaveLength(0);
    });

    it("exposes status and getters correctly", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        expect(() => encoder.getBuffer()).toThrow(
            "Audio is not yet decoded/encoded",
        );
        await expect(() => encoder.getFile()).toThrow(
            "Audio is not yet decoded/encoded",
        );

        encoder.setBuffer(Buffer.from("input"));
        await encoder.encode();
        expect(encoder.getStatus().finished).toBe(true);
    });

    it("propagates errors reported on stderr", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("input"));

        spawnBehavior = (process) => {
            setTimeout(() => {
                process.stderr.emit(
                    "data",
                    Buffer.from("Error unexpected failure"),
                );
            }, 5);
        };

        await expect(encoder.encode()).rejects.toThrow(
            "lame: Error unexpected failure",
        );
    });

    it("handles exit code 255 as a failure", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("input"));

        spawnBehavior = (process) => {
            setTimeout(() => {
                process.emit("close", 255);
            }, 5);
        };

        await expect(encoder.encode()).rejects.toThrow(
            "Unexpected termination of the process",
        );
    });

    it("writes encoded data to file outputs", async () => {
        const tempDir = await createTempDir();
        const outputFile = join(tempDir, "output.mp3");
        const encoder = new Lame({ output: outputFile, bitrate: 128 });
        encoder.setBuffer(Buffer.from("input"));

        spawnBehavior = (process, args) => {
            setTimeout(async () => {
                const outputPath = args[1];
                await writeFileBuffer(outputPath, Buffer.from("file-encoded"));
                process.emit("close", 0);
            }, 5);
        };

        await encoder.encode();
        const fileContent = await fsPromises.readFile(outputFile, "utf-8");
        expect(fileContent).toBe("file-encoded");
        expect(encoder.getFile()).toBe(outputFile);
    });

    it("removes buffer temp files when spawning fails synchronously", async () => {
        const customTemp = await createTempDir();
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setTempPath(customTemp);
        encoder.setBuffer(Buffer.from("input"));

        spawnMock.mockImplementation(() => {
            throw new Error("spawn failure");
        });

        await expect(encoder.encode()).rejects.toThrow("spawn failure");

        const rawDir = join(customTemp, "raw");
        const encodedDir = join(customTemp, "encoded");

        const rawEntries = await fsPromises.readdir(rawDir).catch(() => []);
        const encodedEntries = await fsPromises
            .readdir(encodedDir)
            .catch(() => []);

        expect(rawEntries).toHaveLength(0);
        expect(encodedEntries).toHaveLength(0);
    });

    it("rejects when temporary buffer output is not a Buffer instance", async () => {
        const originalIsBuffer = Buffer.isBuffer;
        let invocation = 0;
        const isBufferSpy = vi
            .spyOn(Buffer, "isBuffer")
            .mockImplementation((value: unknown) => {
                invocation += 1;
                if (invocation === 2) {
                    return false;
                }
                return originalIsBuffer(value);
            });

        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("input"));

        await expect(encoder.encode()).rejects.toThrow(
            "Unexpected output format received from temporary file",
        );

        isBufferSpy.mockRestore();
    });

    it("ignores short progress payloads", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("input"));

        spawnBehavior = (process, args) => {
            setTimeout(async () => {
                process.stdout.emit("data", Buffer.from("ok"));
                const outputPath = args[1];
                await writeFileBuffer(outputPath, Buffer.from("encoded"));
                process.stdout.emit(
                    "data",
                    Buffer.from("Writing LAME Tag...done"),
                );
                process.emit("close", 0);
            }, 5);
        };

        await encoder.encode();
        expect(encoder.getStatus().finished).toBe(true);
    });

    it("handles decode progress entries that produce NaN", async () => {
        const inputPath = await createTempFile(Buffer.from("input"));
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setFile(inputPath);

        const observed: Array<[number, string?]> = [];
        encoder.getEmitter().on("progress", (payload) => {
            observed.push([payload[0], payload[1]]);
        });

        spawnBehavior = (process, args) => {
            setTimeout(async () => {
                const outputPath = args[1];
                await writeFileBuffer(outputPath, Buffer.from("decoded"));
                process.stderr.emit("data", Buffer.from("Frame 0/0"));
                process.stderr.emit("data", Buffer.from("Frame 2/2"));
                process.emit("close", 0);
            }, 5);
        };

        await encoder.decode();
        expect(observed.at(-1)?.[0]).toBe(100);
    });

    it("parses encode progress emitted on stdout", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("input"));

        let stdoutListener: ((chunk: Buffer) => void) | undefined;
        const progressValues: number[] = [];
        encoder.getEmitter().on("progress", ([value]) => {
            progressValues.push(value);
        });

        spawnMock.mockImplementation((_, args) => {
            const process = new EventEmitter() as MockChildProcess;
            const stdin = new EventEmitter() as WritableMock;
            stdin.destroyed = false;
            stdin.write = vi.fn(() => true);
            stdin.end = vi.fn(() => {
                stdin.destroyed = true;
            });
            process.stdin = stdin;
            process.stdout = new EventEmitter();
            process.stderr = new EventEmitter();
            process.kill = vi.fn();

            process.stdout.on = vi.fn((event: string, listener: (...args: unknown[]) => void) => {
                process.stdout.addListener(event, listener);
                if (event === "data") {
                    stdoutListener = listener as (chunk: Buffer) => void;
                }
                return process.stdout;
            });

            process.stderr.on = vi.fn((event: string, listener: (...args: unknown[]) => void) => {
                process.stderr.addListener(event, listener);
                return process.stderr;
            });

            setTimeout(async () => {
                const outputPath = args[1];
                await writeFileBuffer(outputPath, Buffer.from("encoded"));
                stdoutListener?.(Buffer.from("Frame (42%)| 01:23 "));
                stdoutListener?.(Buffer.from("Writing LAME Tag...done"));
                process.emit("close", 0);
            }, 5);

            return process;
        });

        await encoder.encode();
        expect(progressValues[0]).toBe(42);
        expect(encoder.getStatus().progress).toBe(100);
        expect(encoder.getStatus().eta).toBe("00:00");
    });

    it("parses decode progress emitted on stderr", async () => {
        const inputPath = await createTempFile(Buffer.from("input"));
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setFile(inputPath);

        let stderrListener: ((chunk: Buffer) => void) | undefined;
        const progressValues: number[] = [];
        encoder.getEmitter().on("progress", ([value]) => {
            progressValues.push(value);
        });

        spawnMock.mockImplementation((_, args) => {
            const process = new EventEmitter() as MockChildProcess;
            const stdin = new EventEmitter() as WritableMock;
            stdin.destroyed = false;
            stdin.write = vi.fn(() => true);
            stdin.end = vi.fn(() => {
                stdin.destroyed = true;
            });
            process.stdin = stdin;
            process.stdout = new EventEmitter();
            process.stderr = new EventEmitter();
            process.kill = vi.fn();

            process.stdout.on = vi.fn((event: string, listener: (...args: unknown[]) => void) => {
                process.stdout.addListener(event, listener);
                return process.stdout;
            });

            process.stderr.on = vi.fn((event: string, listener: (...args: unknown[]) => void) => {
                process.stderr.addListener(event, listener);
                if (event === "data") {
                    stderrListener = listener as (chunk: Buffer) => void;
                }
                return process.stderr;
            });

            setTimeout(async () => {
                const outputPath = args[1];
                await writeFileBuffer(outputPath, Buffer.from("decoded"));
                stderrListener?.(Buffer.from("Frame 3/5"));
                process.emit("close", 0);
            }, 5);

            return process;
        });

        await encoder.decode();
        expect(progressValues[0]).toBe(60);
        expect(encoder.getStatus().progress).toBeGreaterThan(50);
    });

    it("ignores decode progress lines that do not match expected format", async () => {
        const inputPath = await createTempFile(Buffer.from("input"));
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setFile(inputPath);

        spawnBehavior = (process, args) => {
            setTimeout(async () => {
                const outputPath = args[1];
                await writeFileBuffer(outputPath, Buffer.from("decoded"));
                process.stderr.emit("data", Buffer.from("Some random text"));
                process.emit("close", 0);
            }, 5);
        };

        await encoder.decode();
        expect(encoder.getStatus().finished).toBe(true);
    });

    it("prefixes warning and error outputs with lame label", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("input"));

        const errors: string[] = [];
        encoder.getEmitter().on("error", (error) => errors.push(error.message));

        spawnBehavior = (process, args) => {
            setTimeout(async () => {
                const outputPath = args[1];
                await writeFileBuffer(outputPath, Buffer.from("encoded"));
                process.stderr.emit("data", Buffer.from("Warning: clipped"));
                process.stderr.emit("data", Buffer.from("Error loading table"));
                process.stderr.emit("data", Buffer.from("lame: fatal"));
                process.stdout.emit(
                    "data",
                    Buffer.from("Writing LAME Tag...done"),
                );
                process.emit("close", 0);
            }, 5);
        };

        await encoder.encode().catch(() => {});

        expect(errors).toContain("lame: Warning: clipped");
        expect(errors).toContain("lame: Error loading table");
        expect(errors).toContain("lame: fatal");
    });

    it("emits dedicated error for exit code 255", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("input"));

        const errors: string[] = [];
        encoder.getEmitter().on("error", (error) => errors.push(error.message));

        spawnBehavior = (process) => {
            setTimeout(() => {
                process.emit("close", 255);
            }, 5);
        };

        await expect(encoder.encode()).rejects.toThrow(
            "Unexpected termination of the process, possibly directly after the start. Please check if the input and/or output does not exist.",
        );
        expect(errors).toHaveLength(1);
    });

    it("ensures output directories exist for nested file targets", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        const baseDir = await createTempDir();
        const nestedFile = join(baseDir, "nested", "out.mp3");

        // @ts-expect-error accessing private method for coverage
        await encoder.ensureOutputDirectoryExists(nestedFile);

        const stats = await fsPromises.stat(join(baseDir, "nested"));
        expect(stats.isDirectory()).toBe(true);

        // @ts-expect-error accessing private method for coverage
        await expect(encoder.ensureOutputDirectoryExists("relative.mp3")).resolves.toBeUndefined();
    });

    it("generates raw decode temp files with mp3 extension", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        const customTemp = await createTempDir();
        encoder.setTempPath(customTemp);

        // @ts-expect-error accessing private method for coverage
        const path = await encoder.generateTempFilePath("raw", "decode");
        expect(path.endsWith(".mp3")).toBe(true);
    });

    it("removes temporary artifacts when requested", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        const temp = await createTempDir();
        const fileTemp = join(temp, "buffer.raw");
        const encodedTemp = join(temp, "encoded.mp3");
        await writeFileBuffer(fileTemp, Buffer.from("rawdata"));
        await writeFileBuffer(encodedTemp, Buffer.from("encoded"));

        Object.assign(encoder as unknown as Record<string, unknown>, {
            fileBufferTempFilePath: fileTemp,
            progressedBufferTempFilePath: encodedTemp,
        });

        // @ts-expect-error accessing private method for coverage
        await encoder.removeTempArtifacts();

        await expect(fsPromises.stat(fileTemp)).rejects.toThrow();
        await expect(fsPromises.stat(encodedTemp)).rejects.toThrow();
    });

    it("skips removing temporary artifacts when none exist", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });

        // @ts-expect-error accessing private method for coverage
        await expect(encoder.removeTempArtifacts()).resolves.toBeUndefined();
    });

    describe("progress parsing helpers", () => {
        it("parses encode progress and eta", () => {
            const parsed = parseEncodeProgressLine("Frame (42%)| 01:23 ");
            expect(parsed).toEqual({ progress: 42, eta: "01:23" });
            expect(parseEncodeProgressLine("no progress")).toBeNull();
        });

        it("parses decode progress values", () => {
            expect(parseDecodeProgressLine("Frame 3/5")).toBe(60);
            expect(parseDecodeProgressLine("Frame 0/0")).toBeNaN();
            expect(parseDecodeProgressLine("irrelevant")).toBeNull();
            expect(parseDecodeProgressLine("3/" as unknown as string)).toBeNull();
        });

        it("normalizes CLI messages", () => {
            expect(normalizeCliMessage("Warning: clipped")).toBe(
                "lame: Warning: clipped",
            );
            expect(normalizeCliMessage("lame: fatal")).toBe("lame: fatal");
            expect(normalizeCliMessage("other message")).toBeNull();
        });
    });
});
