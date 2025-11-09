import { chmod } from "node:fs/promises";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Lame } from "../../src/core/lame";
import { LameStream } from "../../src/core/lame-stream";

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
const logPath = process.env.LAME_TEST_LOG;
if (logPath) {
  writeFileSync(logPath, JSON.stringify({ argv: process.argv.slice(2) }), 'utf8');
}
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

const createStreamingBinary = async () => {
    const workdir = await createWorkdir();
    const script = `#!/usr/bin/env sh
input="$1"
output="$2"
shift 2
should_fail="$LAME_STREAM_FAIL"
mode="$LAME_STREAM_MODE"
is_decode=0
for arg in "$@"; do
  if [ "$arg" = "--decode" ]; then
    is_decode=1
  fi
done

if [ "$should_fail" = "1" ]; then
  echo "Warning: simulated streaming failure" >&2
  exit 1
fi

if [ "$input" = "-" ]; then
  if [ "$output" = "-" ]; then
    cat
  else
    cat > "$output"
  fi
else
  if [ "$output" = "-" ]; then
    cat "$input"
  else
    cat "$input" > "$output"
  fi
fi

if [ "$is_decode" -eq 1 ]; then
  if [ "$mode" = "noise" ]; then
    echo "decode noise message" >&2
  fi
  echo "1/2" >&2
  echo "2/2" >&2
  if [ "$mode" = "fail-decode" ]; then
    echo "Warning: decode failure" >&2
    exit 3
  fi
  echo "Writing LAME Tag...done" >&2
else
  echo "( 25%)| 00:02 " >&2
  echo "( 75%)| 00:01 " >&2
  echo "(100%)| 00:00 " >&2
  if [ "$mode" = "noise" ]; then
    echo "encode progress noise" >&2
  fi
  if [ "$mode" = "fail-encode" ]; then
    echo "Warning: encode failure" >&2
    exit 2
  fi
  echo "Writing LAME Tag...done" >&2
fi

exit 0
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

    const originalLogEnv = process.env.LAME_TEST_LOG;
    const originalStreamFailEnv = process.env.LAME_STREAM_FAIL;

    const readLoggedArgs = async (logPath: string) => {
        const raw = await readFile(logPath, "utf8");
        const parsed = JSON.parse(raw) as { argv: string[] };
        return parsed.argv;
    };

    afterEach(async () => {
        if (originalLogEnv === undefined) {
            delete process.env.LAME_TEST_LOG;
        } else {
            process.env.LAME_TEST_LOG = originalLogEnv;
        }

        if (originalStreamFailEnv === undefined) {
            delete process.env.LAME_STREAM_FAIL;
        } else {
            process.env.LAME_STREAM_FAIL = originalStreamFailEnv;
        }

        while (binaries.length) {
            binaries.pop();
        }
        await Promise.all(
            workdirs.splice(0, workdirs.length).map((dir) =>
                rm(dir, { recursive: true, force: true }),
            ),
        );
    });

    describe("Encoding scenarios", () => {
        it("encodes buffers to buffers with constant bitrate", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "encode-buffer-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const encoder = new Lame({ output: "buffer", bitrate: 160 });
            encoder.setBuffer(Buffer.from("integration-buffer-input"));
            encoder.setLamePath(fakeBinaryPath);

            await encoder.encode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(expect.arrayContaining(["-b", "160"]));
            expect(encoder.getBuffer().toString()).toBe(
                "integration-buffer-input",
            );
            expect(encoder.getStatus().finished).toBe(true);
        });

        it("encodes Float32Array inputs by normalizing to PCM", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "encode-float-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const encoder = new Lame({
                output: "buffer",
                raw: true,
                bitrate: 128,
            });

            const samples = new Float32Array([-1, 0, 1]);
            encoder.setBuffer(samples);
            encoder.setLamePath(fakeBinaryPath);

            await encoder.encode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(expect.arrayContaining(["-r"]));

            const output = encoder.getBuffer();
            const expected = Buffer.alloc(6);
            expected.writeInt16LE(-32768, 0);
            expected.writeInt16LE(0, 2);
            expected.writeInt16LE(32767, 4);
            expect(Buffer.compare(output, expected)).toBe(0);
        });

        it("encodes files to disk with constant bitrate", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "encode-file-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const inputPath = join(workdir, "input.raw");
            const outputPath = join(workdir, "output.mp3");
            const inputBuffer = randomBytes(24);
            await writeFile(inputPath, Uint8Array.from(inputBuffer));

            const encoder = new Lame({ output: outputPath, bitrate: 192 });
            encoder.setFile(inputPath);
            encoder.setLamePath(fakeBinaryPath);

            await encoder.encode();

            const produced = await readFile(outputPath);
            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(expect.arrayContaining([inputPath, outputPath]));
            expect(argv).toEqual(expect.arrayContaining(["-b", "192"]));
            expect(produced.equals(Uint8Array.from(inputBuffer))).toBe(true);
        });

        it("encodes raw stereo input with channel and format options", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "encode-raw-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const inputPath = join(workdir, "raw.pcm");
            const outputPath = join(workdir, "raw.mp3");
            await writeFile(inputPath, randomBytes(32));

            const encoder = new Lame({
                output: outputPath,
                raw: true,
                "swap-bytes": true,
                sfreq: 32,
                bitwidth: 16,
                "little-endian": true,
                mode: "m",
                "to-mono": true,
                freeformat: true,
            });
            encoder.setFile(inputPath);
            encoder.setLamePath(fakeBinaryPath);

            await encoder.encode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(
                expect.arrayContaining([
                    inputPath,
                    outputPath,
                    "-r",
                    "-x",
                    "-s",
                    "32",
                    "-m",
                    "m",
                    "-a",
                    "--freeformat",
                ]),
            );
        });

        it("encodes using numeric preset and old VBR routine", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "encode-preset-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const encoder = new Lame({
                output: "buffer",
                preset: 192,
                "vbr-old": true,
                quality: 2,
            });
            encoder.setBuffer(Buffer.from("preset-input"));
            encoder.setLamePath(fakeBinaryPath);

            await encoder.encode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(
                expect.arrayContaining(["--preset", "192", "--vbr-old", "-q", "2"]),
            );
        });

        it("encodes with ABR and bitrate bounds", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "encode-abr-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const encoder = new Lame({
                output: "buffer",
                abr: 210,
                "max-bitrate": 256,
                "vbr-new": true,
            });
            encoder.setBuffer(Buffer.from("abr-input"));
            encoder.setLamePath(fakeBinaryPath);

            await encoder.encode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(
                expect.arrayContaining(["--abr", "210", "-B", "256", "--vbr-new"]),
            );
        });

        it("encodes with metadata and custom frames", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "encode-meta-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const encoder = new Lame({
                output: "buffer",
                bitrate: 192,
                meta: {
                    title: "Demo",
                    artist: "Artist",
                    custom: {
                        TXXX: "Recorded with node-lame",
                    },
                    "pad-id3v2": true,
                },
            });
            encoder.setBuffer(Buffer.from("meta-input"));
            encoder.setLamePath(fakeBinaryPath);

            await encoder.encode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(
                expect.arrayContaining([
                    "--tt",
                    "Demo",
                    "--ta",
                    "Artist",
                    "--pad-id3v2",
                    "--tv",
                    "TXXX=Recorded with node-lame",
                ]),
            );
        });

        it("encodes gapless albums with nogap options", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "encode-gapless-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const track1 = join(workdir, "track-1.raw");
            const track2 = join(workdir, "track-2.raw");
            const track3 = join(workdir, "track-3.raw");
            await Promise.all(
                [track1, track2, track3].map((file) =>
                    writeFile(file, randomBytes(8)),
                ),
            );
            const gaplessDir = join(workdir, "gapless-output");
            const encoder = new Lame({
                output: join(gaplessDir, "track-1.mp3"),
                bitrate: 160,
                nogap: [track2, track3],
                "nogapout": gaplessDir,
                "nogaptags": true,
            });
            encoder.setFile(track1);
            encoder.setLamePath(fakeBinaryPath);

            await encoder.encode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(expect.arrayContaining(["--nogap", track2, track3]));
            expect(argv).toEqual(expect.arrayContaining(["--nogapout", gaplessDir]));
            expect(argv).toContain("--nogaptags");
        });

        it("encodes with gain, scale, and ReplayGain toggles", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "encode-gain-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const encoder = new Lame({
                output: "buffer",
                gain: 3,
                scale: 0.8,
                "scale-l": 0.9,
                "scale-r": 0.95,
                "replaygain-accurate": true,
                "no-replaygain": true,
                "clip-detect": true,
            });
            encoder.setBuffer(Buffer.from("gain-input"));
            encoder.setLamePath(fakeBinaryPath);

            await encoder.encode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(
                expect.arrayContaining([
                    "--gain",
                    "3",
                    "--scale",
                    "0.8",
                    "--scale-l",
                    "0.9",
                    "--scale-r",
                    "0.95",
                    "--replaygain-accurate",
                    "--noreplaygain",
                    "--clipdetect",
                ]),
            );
        });

        it("encodes with strict ISO enforcement and freeformat", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "encode-iso-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const encoder = new Lame({
                output: "buffer",
                "strictly-enforce-ISO": true,
                freeformat: true,
                "no-histogram": true,
                disptime: false,
            });
            encoder.setBuffer(Buffer.from("iso-input"));
            encoder.setLamePath(fakeBinaryPath);

            await encoder.encode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(
                expect.arrayContaining([
                    "--strictly-enforce-ISO",
                    "--freeformat",
                    "--nohist",
                ]),
            );
            expect(argv).not.toContain("--disptime");
        });

        it("encodes with priority and verbose logging", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "encode-priority-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const encoder = new Lame({
                output: "buffer",
                priority: 4,
                disptime: 4,
                verbose: true,
            });
            encoder.setBuffer(Buffer.from("priority-input"));
            encoder.setLamePath(fakeBinaryPath);

            await encoder.encode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(
                expect.arrayContaining([
                    "--priority",
                    "4",
                    "--disptime",
                    "4",
                    "--verbose",
                ]),
            );
        });
    });

    describe("Decoding scenarios", () => {
        const createMp3File = async (dir: string, name: string) => {
            const file = join(dir, name);
            await writeFile(file, randomBytes(32));
            return file;
        };

        it("decodes files to buffers", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "decode-buffer-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const mp3Path = await createMp3File(workdir, "input.mp3");

            const decoder = new Lame({ output: "buffer" });
            decoder.setFile(mp3Path);
            decoder.setLamePath(fakeBinaryPath);

            await decoder.decode();

            const argv = await readLoggedArgs(logPath);
            expect(argv[0]).toBe(mp3Path);
            expect(argv).toContain("--decode");
            expect(decoder.getBuffer()).toBeInstanceOf(Buffer);
        });

        it("decodes files to explicit output paths", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "decode-file-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const mp3Path = await createMp3File(workdir, "sample.mp3");
            const outputPath = join(workdir, "decoded.raw");

            const decoder = new Lame({ output: outputPath });
            decoder.setFile(mp3Path);
            decoder.setLamePath(fakeBinaryPath);

            await decoder.decode();

            const decoded = await readFile(outputPath);
            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(expect.arrayContaining([mp3Path, outputPath, "--decode"]));
            expect(decoded.length).toBeGreaterThan(0);
        });

        it("decodes buffers to disk outputs", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "decode-buffer-to-file.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const outputPath = join(workdir, "buffer-decode.raw");

            const decoder = new Lame({ output: outputPath });
            decoder.setBuffer(Buffer.from("buffer-mp3"));
            decoder.setLamePath(fakeBinaryPath);

            await decoder.decode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(expect.arrayContaining([outputPath, "--decode"]));
            const output = await readFile(outputPath);
            expect(output.length).toBeGreaterThan(0);
        });

        it("decodes with mp3 delay compensation", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "decode-delay-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const mp3Path = await createMp3File(workdir, "delay.mp3");

            const decoder = new Lame({
                output: "buffer",
                "decode-mp3delay": 576,
            });
            decoder.setFile(mp3Path);
            decoder.setLamePath(fakeBinaryPath);

            await decoder.decode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(
                expect.arrayContaining(["--decode-mp3delay", "576", "--decode"]),
            );
        });

        it("decodes with resample and lowpass options", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "decode-resample-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const mp3Path = await createMp3File(workdir, "resample.mp3");

            const decoder = new Lame({
                output: "buffer",
                resample: 32,
                lowpass: 18,
            });
            decoder.setFile(mp3Path);
            decoder.setLamePath(fakeBinaryPath);

            await decoder.decode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(
                expect.arrayContaining(["--resample", "32", "--lowpass", "18", "--decode"]),
            );
        });

        it("decodes with highpass filter and no disptime", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "decode-highpass-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const mp3Path = await createMp3File(workdir, "highpass.mp3");

            const decoder = new Lame({
                output: "buffer",
                highpass: 5,
                disptime: false,
            });
            decoder.setFile(mp3Path);
            decoder.setLamePath(fakeBinaryPath);

            await decoder.decode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(expect.arrayContaining(["--highpass", "5", "--decode"]));
            expect(argv).not.toContain("--disptime");
        });

        it("decodes with priority and quiet mode", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "decode-priority-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const mp3Path = await createMp3File(workdir, "priority.mp3");

            const decoder = new Lame({
                output: "buffer",
                priority: 2,
                quiet: true,
            });
            decoder.setFile(mp3Path);
            decoder.setLamePath(fakeBinaryPath);

            await decoder.decode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(
                expect.arrayContaining(["--priority", "2", "--quiet", "--decode"]),
            );
        });

        it("decodes with silent output", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "decode-silent-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const mp3Path = await createMp3File(workdir, "silent.mp3");

            const decoder = new Lame({
                output: "buffer",
                silent: true,
            });
            decoder.setFile(mp3Path);
            decoder.setLamePath(fakeBinaryPath);

            await decoder.decode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(
                expect.arrayContaining(["--silent", "--decode"]),
            );
        });

        it("decodes while passing metadata flags", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "decode-meta-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const mp3Path = await createMp3File(workdir, "meta.mp3");

            const decoder = new Lame({
                output: "buffer",
                meta: {
                    title: "Decoded",
                    custom: ["TXXX=decoded"],
                },
            });
            decoder.setFile(mp3Path);
            decoder.setLamePath(fakeBinaryPath);

            await decoder.decode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(
                expect.arrayContaining(["--tt", "Decoded", "--tv", "TXXX=decoded", "--decode"]),
            );
        });

        it("decodes with strict ISO enforcement", async () => {
            const workdir = await createWorkdir();
            const logPath = join(workdir, "decode-iso-log.json");
            process.env.LAME_TEST_LOG = logPath;

            const fakeBinaryPath = await createPassthroughBinary();
            const mp3Path = await createMp3File(workdir, "iso.mp3");

            const decoder = new Lame({
                output: "buffer",
                "strictly-enforce-ISO": true,
            });
            decoder.setFile(mp3Path);
            decoder.setLamePath(fakeBinaryPath);

            await decoder.decode();

            const argv = await readLoggedArgs(logPath);
            expect(argv).toEqual(
                expect.arrayContaining(["--strictly-enforce-ISO", "--decode"]),
            );
        });
    });

    describe("Streaming scenarios", () => {
        it("encodes streaming PCM input to MP3 output", async () => {
            const fakeBinaryPath = await createStreamingBinary();
            const encoderStream = new LameStream({
                binaryPath: fakeBinaryPath,
                bitrate: 128,
                mode: "encode",
            });

            encoderStream.getEmitter().on("error", () => {});

            const progressValues: number[] = [];
            const encodedChunks: Buffer[] = [];

            encoderStream.getEmitter().on("progress", ([value]) => {
                progressValues.push(value);
            });
            encoderStream.on("data", (chunk) => encodedChunks.push(chunk));

            const finishSpy = vi.fn();
            encoderStream.getEmitter().once("finish", finishSpy);

            const finished = new Promise<void>((resolve, reject) => {
                encoderStream.on("end", resolve);
                encoderStream.on("error", reject);
            });
            const streamClosed = new Promise<void>((resolve) => {
                encoderStream.on("close", resolve);
            });

            const source = new PassThrough();
            source.pipe(encoderStream);
            source.end(Buffer.from("stream-input"));

            await finished;
            await streamClosed;

            expect(finishSpy).toHaveBeenCalled();
            expect(progressValues.at(-1)).toBe(100);
            expect(encoderStream.getStatus().finished).toBe(true);
            expect(Buffer.concat(encodedChunks).toString()).toBe("stream-input");
        });

        it("decodes streaming MP3 input to PCM output", async () => {
            const fakeBinaryPath = await createStreamingBinary();
            const decoderStream = new LameStream({
                binaryPath: fakeBinaryPath,
                mode: "decode",
            });

            decoderStream.getEmitter().on("error", () => {});

            const progressValues: number[] = [];
            const decodedChunks: Buffer[] = [];

            decoderStream.getEmitter().on("progress", ([value]) => {
                progressValues.push(value);
            });
            decoderStream.on("data", (chunk) => decodedChunks.push(chunk));

            const finishSpy = vi.fn();
            decoderStream.getEmitter().once("finish", finishSpy);

            const finished = new Promise<void>((resolve, reject) => {
                decoderStream.on("end", resolve);
                decoderStream.on("error", reject);
            });
            const streamClosed = new Promise<void>((resolve) => {
                decoderStream.on("close", resolve);
            });

            const source = new PassThrough();
            source.pipe(decoderStream);
            source.end(Buffer.from("mp3-stream"));

            await finished;
            await streamClosed;

            expect(finishSpy).toHaveBeenCalled();
            expect(progressValues.at(-1)).toBe(100);
            expect(decoderStream.getStatus().finished).toBe(true);
            expect(Buffer.concat(decodedChunks).toString()).toBe("mp3-stream");
        });

        it("propagates streaming warnings as errors", async () => {
            const previousFail = process.env.LAME_STREAM_FAIL;
            process.env.LAME_STREAM_FAIL = "1";

            const fakeBinaryPath = await createStreamingBinary();
            const encoderStream = new LameStream({
                binaryPath: fakeBinaryPath,
                mode: "encode",
            });

            encoderStream.getEmitter().on("error", () => {});

            const source = new PassThrough();
            const execution = new Promise<void>((resolve, reject) => {
                encoderStream.on("error", (error) => reject(error));
                encoderStream.on("end", () => resolve());
            });

            source.pipe(encoderStream);
            source.end(Buffer.from("warn-stream"));

            await expect(execution).rejects.toThrow(/lame:|EPIPE/);

            if (previousFail === undefined) {
                delete process.env.LAME_STREAM_FAIL;
            } else {
                process.env.LAME_STREAM_FAIL = previousFail;
            }
        });
    });

    describe("Error handling and validation", () => {
        it("bubbles up CLI error messages", async () => {
            const fakeBinaryPath = await createErrorBinary(
                1,
                "Error simulated failure",
            );

            const encoder = new Lame({ output: "buffer", bitrate: 128 });
            encoder.setBuffer(Buffer.from("will fail"));
            encoder.setLamePath(fakeBinaryPath);

            await expect(encoder.encode()).rejects.toThrow(
                /lame: Error simulated failure|lame: Process exited with code 1/,
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

    it("bubbles up CLI error messages", async () => {
        const fakeBinaryPath = await createErrorBinary(
            1,
            "Error simulated failure",
        );

        const encoder = new Lame({ output: "buffer", bitrate: 128 });
        encoder.setBuffer(Buffer.from("will fail"));
        encoder.setLamePath(fakeBinaryPath);

        await expect(encoder.encode()).rejects.toThrow(
            /lame: Error simulated failure|lame: Process exited with code 1/,
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
