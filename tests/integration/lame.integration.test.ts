import { chmod } from "node:fs/promises";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Lame } from "../../src/core/lame";

const shouldRun = process.platform !== "win32";

(shouldRun ? describe : describe.skip)("Lame integration", () => {
    const workdirs: string[] = [];
    const binaries: string[] = [];

    const createWorkdir = async () => {
        const dir = await mkdtemp(join(tmpdir(), "node-lame-int-"));
        workdirs.push(dir);
        return dir;
    };

    const createBinary = async (directory: string, content: string) => {
        const binaryPath = join(directory, `fake-lame-${binaries.length}.mjs`);
        await writeFile(binaryPath, content, { mode: 0o755 });
        await chmod(binaryPath, 0o755);
        binaries.push(binaryPath);
        return binaryPath;
    };

    const createPassthroughBinary = async () => {
        const workdir = await createWorkdir();
        const script = `#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
const [, , input, output] = process.argv;
const payload = readFileSync(input);
writeFileSync(output, payload);
const isDecode = process.argv.includes('--decode');
if (isDecode) {
  console.error('1/2');
  console.error('2/2');
} else {
  console.error('( 50%)| 00:01 ');
  console.log('Writing LAME Tag...done');
}
process.exit(0);
`;
        return createBinary(workdir, script);
    };

    const createErrorBinary = async (exitCode: number, message: string) => {
        const workdir = await createWorkdir();
        const script = `#!/usr/bin/env node
console.error(${JSON.stringify(message)});
process.exit(${exitCode});
`;
        return createBinary(workdir, script);
    };

    afterEach(async () => {
        while (binaries.length) {
            binaries.pop();
        }
        await Promise.all(
            workdirs.splice(0, workdirs.length).map((dir) =>
                rm(dir, { recursive: true, force: true }),
            ),
        );
    });

    it("encodes a buffer to memory via the CLI wrapper", async () => {
        const workdir = await createWorkdir();
        const fakeBinaryPath = await createPassthroughBinary();

        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("integration-buffer-input"));
        encoder.setLamePath(fakeBinaryPath);

        await encoder.encode();

        expect(encoder.getBuffer().toString()).toBe(
            "integration-buffer-input",
        );
        expect(encoder.getStatus().finished).toBe(true);
        expect(encoder.getStatus().progress).toBe(100);

        await rm(workdir, { recursive: true, force: true });
    });

    it("encodes a file to disk and reads the resulting output", async () => {
        const workdir = await createWorkdir();
        const fakeBinaryPath = await createPassthroughBinary();

        const inputPath = join(workdir, "input.raw");
        const outputPath = join(workdir, "output.mp3");
        const inputBuffer = randomBytes(32);
        await writeFile(inputPath, Uint8Array.from(inputBuffer));

        const encoder = new Lame({ output: outputPath, bitrate: 128 });
        encoder.setFile(inputPath);
        encoder.setLamePath(fakeBinaryPath);

        await encoder.encode();

        const encoded = await readFile(outputPath);

        expect(encoded.equals(Uint8Array.from(inputBuffer))).toBe(true);
        expect(encoder.getFile()).toBe(outputPath);
    });

    it("decodes a file while reporting progress", async () => {
        const workdir = await createWorkdir();
        const fakeBinaryPath = await createPassthroughBinary();

        const mp3Path = join(workdir, "input.mp3");
        const mp3Payload = randomBytes(24);
        await writeFile(mp3Path, Uint8Array.from(mp3Payload));

        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setFile(mp3Path);
        encoder.setLamePath(fakeBinaryPath);

        await encoder.decode();

        expect(encoder.getBuffer()).toBeInstanceOf(Buffer);
        expect(encoder.getStatus().progress).toBe(100);
        expect(encoder.getStatus().eta).toBe("00:00");
    });

    it("passes through an extensive option set to the CLI", async () => {
        const workdir = await createWorkdir();
        const fakeBinaryPath = await createPassthroughBinary();

        const inputPath = join(workdir, "input.raw");
        const outputPath = join(workdir, "output.mp3");
        const inputPayload = randomBytes(48);
        await writeFile(inputPath, Uint8Array.from(inputPayload));

        const encoder = new Lame({
            output: outputPath,
            raw: true,
            "swap-bytes": true,
            sfreq: 44.1,
            bitwidth: 16,
            signed: true,
            unsigned: true,
            "little-endian": true,
            "big-endian": true,
            mp2Input: true,
            mp3Input: true,
            mode: "j",
            "to-mono": true,
            "channel-different-block-sizes": true,
            freeformat: "LAME",
            "disable-info-tag": true,
            comp: 1.2,
            scale: 0.8,
            "scale-l": 0.9,
            "scale-r": 0.95,
            "replaygain-fast": true,
            "replaygain-accurate": true,
            "no-replaygain": true,
            "clip-detect": true,
            preset: "standard",
            noasm: "sse",
            quality: 4,
            bitrate: 192,
            "force-bitrate": true,
            cbr: true,
            abr: 192,
            vbr: true,
            "vbr-quality": 3,
            "ignore-noise-in-sfb21": true,
            emp: "n",
            "crc-error-protection": true,
            nores: true,
            "strictly-enforce-ISO": true,
            lowpass: 18,
            "lowpass-width": 2,
            highpass: 3,
            "highpass-width": 2,
            resample: 32,
            meta: {
                title: "Title",
                artist: "Artist",
                album: "Album",
                year: "2024",
                comment: "Comment",
                track: "1",
                genre: "Genre",
                "add-id3v2": true,
                "id3v1-only": true,
                "id3v2-only": true,
                "id3v2-latin1": true,
                "id3v2-utf16": true,
                "space-id3v1": true,
                "pad-id3v2-size": 2,
                "genre-list": "Rock,Pop",
                "ignore-tag-errors": true,
            },
            "mark-as-copyrighted": true,
            "mark-as-copy": true,
        });

        encoder.setFile(inputPath);
        encoder.setLamePath(fakeBinaryPath);

        await encoder.encode();

        const outputPayload = await readFile(outputPath);
        expect(outputPayload.equals(Uint8Array.from(inputPayload))).toBe(true);
        expect(encoder.getStatus().finished).toBe(true);
    });

    it("bubbles up CLI error messages", async () => {
        const fakeBinaryPath = await createErrorBinary(
            1,
            "Error simulated failure",
        );

        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("will fail"));
        encoder.setLamePath(fakeBinaryPath);

        await expect(encoder.encode()).rejects.toThrow(
            "lame: Error simulated failure",
        );
    });

    it("treats exit code 255 as unexpected termination", async () => {
        const fakeBinaryPath = await createErrorBinary(
            255,
            "Unexpected termination",
        );

        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("will fail badly"));
        encoder.setLamePath(fakeBinaryPath);

        await expect(encoder.encode()).rejects.toThrow(
            "Unexpected termination of the process",
        );
    });

    it("validates that an input source is set before encoding", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        await expect(encoder.encode()).rejects.toThrow(
            "Audio file to encode is not set",
        );
    });

    it("throws when accessing outputs before processing", () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        expect(() => encoder.getBuffer()).toThrow(
            "Audio is not yet decoded/encoded",
        );
        expect(() => encoder.getFile()).toThrow(
            "Audio is not yet decoded/encoded",
        );
    });

    it("guards invalid path setters", () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        expect(() => encoder.setLamePath("")).toThrow(
            "Lame path must be a non-empty string",
        );
        expect(() => encoder.setTempPath("   ")).toThrow(
            "Temp path must be a non-empty string",
        );
        expect(() => encoder.setFile("/does/not/exist")).toThrow(
            "Audio file (path) does not exist",
        );
    });

    it("propagates spawn errors when the binary cannot be executed", async () => {
        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("input"));
        encoder.setLamePath("/non-existent/node-lame-binary");

        await expect(encoder.encode()).rejects.toThrow(/ENOENT/);
    });

    it("rejects when CLI output cannot be read as Buffer", async () => {
        const workdir = await createWorkdir();
        const fakeBinaryPath = await createPassthroughBinary();

        const originalIsBuffer = Buffer.isBuffer;
        let callCount = 0;
        const isBufferSpy = vi
            .spyOn(Buffer, "isBuffer")
            .mockImplementation((value: unknown) => {
                callCount += 1;
                if (callCount === 2) {
                    return false;
                }
                return originalIsBuffer(value);
            });

        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("integration-non-buffer"));
        encoder.setLamePath(fakeBinaryPath);

        await expect(encoder.encode()).rejects.toThrow(
            "Unexpected output format received from temporary file",
        );

        isBufferSpy.mockRestore();
        await rm(workdir, { recursive: true, force: true });
    });

    it("validates advanced encoder options before execution", () => {
        expect(
            () =>
                new Lame({
                    output: "buffer",
                    resample: 20,
                } as unknown as any),
        ).toThrow(
            "lame: Invalid option: 'resample' is not in range of 8, 11.025, 12, 16, 22.05, 24, 32, 44.1 or 48.",
        );

        expect(
            () =>
                new Lame({
                    output: "buffer",
                    meta: {
                        unexpected: "value",
                    },
                } as unknown as any),
        ).toThrow("lame: Invalid option: 'meta' unknown property 'unexpected'");
    });

    it("removes temporary artifacts when invoked directly", async () => {
        const workdir = await createWorkdir();
        const rawPath = join(workdir, "temp.raw");
        const encodedPath = join(workdir, "temp.mp3");
        await writeFile(rawPath, Buffer.from("raw"));
        await writeFile(encodedPath, Buffer.from("encoded"));

        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        const encoderInternals = encoder as unknown as {
            fileBufferTempFilePath?: string;
            progressedBufferTempFilePath?: string;
            removeTempArtifacts: () => Promise<void>;
        };

        encoderInternals.fileBufferTempFilePath = rawPath;
        encoderInternals.progressedBufferTempFilePath = encodedPath;

        await encoderInternals.removeTempArtifacts();

        await expect(readFile(rawPath)).rejects.toMatchObject({ code: "ENOENT" });
        await expect(readFile(encodedPath)).rejects.toMatchObject({
            code: "ENOENT",
        });
    });
});
