import { EventEmitter } from "node:events";
import * as fsPromises from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MockChildProcess = EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
};

const spawnMock = vi.fn();

type SpawnArgs = [command: string, args: string[]];

vi.mock("node:child_process", () => ({
    spawn: (...args: SpawnArgs) => spawnMock(...args),
}));

const { Lame } = await import("../../src/core/lame");

describe("Lame", () => {
    beforeEach(() => {
        spawnMock.mockReset();
        spawnMock.mockImplementation((command: string, args: string[]) => {
            const process = new EventEmitter() as MockChildProcess;
            process.stdout = new EventEmitter();
            process.stderr = new EventEmitter();
            process.kill = vi.fn();

            setTimeout(() => {
                const outputPath = args[1];
                if (outputPath) {
                    fsPromises
                        .writeFile(
                            outputPath,
                            Uint8Array.from(Buffer.from("encoded")),
                        )
                        .then(() => {
                            process.stdout.emit(
                                "data",
                                Buffer.from("Writing LAME Tag...done"),
                            );
                            process.emit("close", 0);
                        })
                        .catch(() => {
                            process.emit("close", 1);
                        });
                } else {
                    process.emit("close", 1);
                }
            }, 5);

            return process;
        });
    });

    it("encodes buffers and returns the resulting buffer", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("input"));

        await encoder.encode();

        expect(spawnMock).toHaveBeenCalled();
        expect(encoder.getBuffer()).toBeInstanceOf(Buffer);
        expect(encoder.getStatus().finished).toBe(true);
    });
});
