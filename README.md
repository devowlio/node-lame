# node-lame

<img align="right" src="https://assets.devowl.io/git/node-lame/logo.png" alt="node-lame Logo" height="180" />

LAME is an open-source encoder that encodes and decodes audio to the MP3 file format. For all MP3 needs a Node.js wrapper of the full [LAME](http://lame.sourceforge.net/) command line.

The encoder reads WAV-, MP1-, MP2- and MP3-format and encodes it into an MP3 file. The decoder reads MP3-format and decodes it into WAV.

## Requirements

- Recent Linux, macOS, or Windows (x64/ARM64) environment
- Node 20.\* or newer

## Installation

Install the package with your preferred Node.js package manager; the postinstall script will take care of fetching a suitable LAME binary for your platform.

```bash
pnpm add node-lame
# or
npm install node-lame
```

Set environment variables to adjust the download behaviour:

- `LAME_BINARY=/absolute/path/to/lame` – specify a preinstalled executable; set it before running your application so the wrapper uses that path.
- `LAME_FORCE_DOWNLOAD=1` – redownload the packaged binary even when a cached copy exists (set when you install the package).
- `LAME_SKIP_DOWNLOAD=1` – skip the download entirely (set when you install the package and ensure your app has access to a `lame` binary).
- `LAME_VERSION=3.100` – override the default LAME release fetched by the installer (set when you install if you need a different version).

When skipping the download, make sure `LAME_BINARY` or an equivalent mechanism is in place before your application starts, otherwise the wrapper will fall back to the system `lame` and fail if none is available.

## Examples

The following recipes demonstrate the encoder with async/await. Both module systems are supported; choose the import style that matches your project:

- **ES Modules**: `import { Lame } from "node-lame";`
- **CommonJS**: `const { Lame } = require("node-lame");`

The detailed examples below use the ES Modules syntax for brevity, but the logic is identical when using `require` instead of `import`.

### Encode from file to file

Converting a WAV file into an MP3 only requires creating the encoder, supplying a source file, and awaiting `encode()`.

```js
import { Lame } from "node-lame";

const encoder = new Lame({
    output: "./audio-files/demo.mp3",
    bitrate: 192,
});

encoder.setFile("./audio-files/demo.wav");
await encoder.encode();
```

### Encode from file to buffer

When output is set to `"buffer"`, the encoded audio is returned as a Node.js `Buffer` that you can further process.

```js
import { Lame } from "node-lame";

const encoder = new Lame({
    output: "buffer",
    bitrate: 192,
});

encoder.setFile("./audio-files/demo.wav");
await encoder.encode();

const buffer = encoder.getBuffer();
```

### Encode from buffer to file

If you already have PCM data loaded into memory, feed it directly into the encoder and write the result to disk.

```js
import { readFile } from "node:fs/promises";
import { Lame } from "node-lame";

const audioFileBuffer = await readFile("./audio-files/demo.wav");

const encoder = new Lame({
    output: "./audio-files/demo.mp3",
    bitrate: 192,
});

encoder.setBuffer(audioFileBuffer);
await encoder.encode();
```

### Encode from buffer to buffer

Buffer-to-buffer encoding is useful when you want to keep the converted audio in memory rather than touching the filesystem.

```js
import { readFile } from "node:fs/promises";
import { Lame } from "node-lame";

const audioFileBuffer = await readFile("./audio-files/demo.wav");

const encoder = new Lame({
    output: "buffer",
    bitrate: 192,
});

encoder.setBuffer(audioFileBuffer);
await encoder.encode();

const buffer = encoder.getBuffer();
```

### Encode from Float32Array PCM input

Raw PCM floats from web audio streams can be consumed directly without first converting them to integers.

```js
import { Lame } from "node-lame";

const samples = new Float32Array([-1, -0.5, 0, 0.5, 1]);

const encoder = new Lame({
    output: "buffer",
    raw: true,
});

encoder.setBuffer(samples);
await encoder.encode();

const buffer = encoder.getBuffer();
```

`setBuffer` also accepts `Float64Array`, `Int16Array`, `Int32Array`, and other `ArrayBufferView` inputs by converting them to the expected PCM encoding under the hood.

### Get status of encoder as object

```js
import { Lame } from "node-lame";

const encoder = new Lame({
    output: "buffer",
    bitrate: 192,
}).setFile("./audio-files/demo.wav");

await encoder.encode();
const status = encoder.getStatus();
```

### Get status of encoder as EventEmitter

```js
import { Lame } from "node-lame";

const encoder = new Lame({
    output: "buffer",
    bitrate: 192,
}).setFile("./audio-files/demo.wav");

const emitter = encoder.getEmitter();

emitter.on("progress", ([progress, eta]) => {
    // On progress of encoding. Progress in percent and estimated time of arrival as mm:ss
});

emitter.on("finish", () => {
    // On finish
});

emitter.on("error", (error) => {
    // On error
});

await encoder.encode();
```

### Decode from file to file

```js
import { Lame } from "node-lame";

const decoder = new Lame({
    output: "./audio-files/demo.wav",
}).setFile("./audio-files/demo.mp3");

await decoder.decode();
```

### Decode from file to buffer

```js
import { Lame } from "node-lame";

const decoder = new Lame({
    output: "buffer",
}).setFile("./audio-files/demo.mp3");

await decoder.decode();
const buffer = decoder.getBuffer();
```

### Decode from buffer to file

```js
import { Lame } from "node-lame";

const decoder = new Lame({
    output: "./audio-files/demo.wav",
}).setBuffer(mp3InputBuffer);

await decoder.decode();
```

### Decode from buffer to buffer

```js
import { Lame } from "node-lame";

const decoder = new Lame({
    output: "buffer",
}).setBuffer(mp3InputBuffer);

await decoder.decode();
const buffer = decoder.getBuffer();
```

### Get status of decoder as object

```js
import { Lame } from "node-lame";

const decoder = new Lame({
    output: "buffer",
}).setFile("./audio-files/demo.mp3");

await decoder.decode();
const status = decoder.getStatus();
```

### Get status of decoder as EventEmitter

```js
import { Lame } from "node-lame";

const decoder = new Lame({
    output: "buffer",
}).setFile("./audio-files/demo.mp3");

const emitter = decoder.getEmitter();

emitter.on("progress", ([progress]) => {
    // On progress of decoder; in percent
});

emitter.on("finish", () => {
    // On finish
});

emitter.on("error", (error) => {
    // On error
});

await decoder.decode();
```

### Gapless encoding of multiple files

```js
import { join } from "node:path";
import { Lame } from "node-lame";

const sources = [
    "./audio-files/live-intro.wav",
    "./audio-files/live-main.wav",
    "./audio-files/live-outro.wav",
];

const encoder = new Lame({
    output: join("./audio-files/gapless", "live-intro.mp3"),
    bitrate: 192,
    nogap: sources.slice(1),
    "nogapout": "./audio-files/gapless",
    "nogaptags": true,
});

encoder.setFile(sources[0]);
await encoder.encode();
```

When using `nogap`, provide the first track via `.setFile()` and list the remaining tracks in the `nogap` option; `nogapout` should point to the directory where the consecutive MP3 files will be written.

### Inject custom ID3 frames

```js
import { Lame } from "node-lame";

const encoder = new Lame({
    output: "buffer",
    bitrate: 192,
    meta: {
        title: "Live at JSConf",
        artist: "The Asyncs",
        custom: {
            TXXX: "Recorded with node-lame",
            "TXXX:SHOWDATE": "2024-06-15",
        },
    },
});

encoder.setFile("./audio-files/live-set.wav");
await encoder.encode();
```

### Tune CLI verbosity and progress interval

```js
import { Lame } from "node-lame";

const encoder = new Lame({
    output: "buffer",
    bitrate: 160,
    disptime: 5,
    verbose: true,
});

encoder.setFile("./audio-files/podcast.wav");
await encoder.encode();
```

Setting `disptime` changes how often progress is emitted by the LAME CLI, while `silent`, `quiet`, and `verbose` let you align terminal verbosity with your logging needs.

### Encode via Node.js streams

When you already operate on `Readable`/`Writable` streams (for example when piping uploaded audio to disk), use the encoder stream helper to avoid buffering everything in memory.

```js
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { LameStream } from "node-lame";

const encoderStream = new LameStream({
    mode: "encode",
    bitrate: 192,
});

encoderStream.getEmitter().on("progress", ([progress, eta]) => {
    process.stdout.write(
        `Streaming progress: ${progress}%${eta ? ` – ETA ${eta}` : ""}\r`,
    );
});

await pipeline(
    createReadStream("./audio-files/example.wav"),
    encoderStream,
    createWriteStream("./audio-files/example.stream.mp3"),
);
```

### Decode via Node.js streams

Decoding an MP3 back to WAV (or raw PCM) works the same way—swap in the decoder helper and wire it into your existing stream graph.

```js
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { LameStream } from "node-lame";

const decoderStream = new LameStream({
    mode: "decode",
});

decoderStream.getEmitter().on("progress", ([progress, eta]) => {
    process.stdout.write(
        `Decoding progress: ${progress}%${eta ? ` – ETA ${eta}` : ""}\r`,
    );
});

await pipeline(
    createReadStream("./audio-files/example.stream.mp3"),
    decoderStream,
    createWriteStream("./audio-files/example.stream.wav"),
);
```

`LameStream` exposes `getEmitter()` and `getStatus()` so you receive live progress regardless of whether you encode or decode. Choose the direction up front via `mode: "encode"` or `"decode"` when constructing the stream, then treat it like any other duplex pipeline component.

## All options

| Option                        | Description                                                                                                                                                                                                                                                                                                                                                                                                                   | Values                                                                                                                            | Default                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| output                        | Output filename                                                                                                                                                                                                                                                                                                                                                                                                               | Path                                                                                                                              |
| raw                           | Assume the input file is raw pcm. Sampling rate and mono/stereo/jstereo must be specified. For each stereo sample, LAME expects the input data to be ordered left channel first, then right channel. By default, LAME expects them to be signed integers with a bitwidth of 16.                                                                                                                                               | boolean                                                                                                                           | `false`                                             |
| swap-bytes                    | Swap bytes in the input file or output file when using decoding. For sorting out little endian/big endian type problems.                                                                                                                                                                                                                                                                                                      | boolean                                                                                                                           | `false`                                             |
| swap-channel                  | Swap the left and right input channels prior to encoding.                                                                                                                                                                                                                                                                                                                                                                     | boolean                                                                                                                           | `false`                                             |
| sfreq                         | Required only for raw PCM input files. Otherwise it will be determined from the header of the input file. LAME will automatically resample the input file to one of the supported MP3 samplerates if necessary.                                                                                                                                                                                                               | `8`, `11.025`, `12`, `16`, `22.05`, `24`, `32`, `44.1`, `48`                                                                      | `undefined`                                         |
| bitwidth                      | Required only for raw PCM input files. Otherwise it will be determined from the header of the input file.                                                                                                                                                                                                                                                                                                                     | `8`, `16`, `24`, `32`                                                                                                             | `16`                                                |
| signed                        | Required only for raw PCM input files. Instructs LAME that the samples from the input are signed.                                                                                                                                                                                                                                                                                                                             | boolean                                                                                                                           | `false`; `true` for 16, 24 and 32 bits raw pcm data |
| unsigned                      | Required only for raw PCM input files and only available at bitwidth 8. Instructs LAME that the samples from the input are unsigned (the default for 8 bits raw pcm data, where 0x80 is zero).                                                                                                                                                                                                                                | boolean                                                                                                                           | `undefined`                                         |
| little-endian                 | Required only for raw PCM input files. Instructs LAME that the samples from the input are in little-endian form.                                                                                                                                                                                                                                                                                                              | boolean                                                                                                                           | `undefined`                                         |
| big-endian                    | Required only for raw PCM input files. Instructs LAME that the samples from the input are in big-endian form.                                                                                                                                                                                                                                                                                                                 | boolean                                                                                                                           | `undefined`                                         |
| mp1Input                      | Assume the input file is a MPEG Layer I file. Forces LAME to decode MP1 input before re-encoding.                                                                                                                                                                                                                                                                                                                               | boolean                                                                                                                           | `undefined`                                         |
| mp2Input                      | Assume the input file is a MPEG Layer II (ie MP2) file. If the filename ends in ".mp2" LAME will assume it is a MPEG Layer II file.                                                                                                                                                                                                                                                                                           | boolean                                                                                                                           | `undefined`                                         |
| mp3Input                      | Assume the input file is a MP3 file. Useful for downsampling from one mp3 to another.                                                                                                                                                                                                                                                                                                                                         | boolean                                                                                                                           | `undefined`                                         |
| mode                          | Details see [LAME man page](https://linux.die.net/man/1/lame).                                                                                                                                                                                                                                                                                                                                                                | `s` simple stereo, `j` joint stereo, `f` forced MS stereo, `d` dual mono, `m` mono, `l` left channel only, `r` right channel only, `a` alias for joint stereo | `j` or `s` (see details)                            |
| to-mono                       | Mix the stereo input file to mono and encode as mono. The downmix is calculated as the sum of the left and right channel, attenuated by 6 dB.                                                                                                                                                                                                                                                                                 | boolean                                                                                                                           | `false`                                             |
| channel-different-block-sizes | Allows the left and right channels to use different block size types.                                                                                                                                                                                                                                                                                                                                                         | boolean                                                                                                                           | `false`                                             |
| freeformat                    | Produces a free format bitstream. With this option, you can use `bitrate` with any integer between 8 and 640 kbps; only a handful of decoders support streams above 320 kbps.                                                                                                                                                                                                                                                 | boolean                                                                                                                           | `false`                                             |
| disable-info-tag              | Disable writing of the INFO Tag on encoding.                                                                                                                                                                                                                                                                                                                                                                                  | boolean                                                                                                                           | `false`                                             |
| nogap                        | Encode multiple input files back-to-back without gaps. Provide an array of file paths that should play seamlessly.                                                                                                                                                                                                                                                                                                             | array of file paths                                                                                                               | `undefined`                                         |
| nogapout                     | Directory for files produced by `nogap` encoding. Must be provided before `nogap`.                                                                                                                                                                                                                                                                                                                                             | Path                                                                                                                              | `undefined`                                         |
| nogaptags                    | Allow VBR tags while using `nogap` encoding.                                                                                                                                                                                                                                                                                                                                                                                   | boolean                                                                                                                           | `false`                                             |
| out-dir                      | Override the default output directory when no explicit output file is configured.                                                                                                                                                                                                                                                                                                                                              | Path                                                                                                                              | `undefined`                                         |
| comp                          | Instead of choosing bitrate, using this option, user can choose compression ratio to achieve.                                                                                                                                                                                                                                                                                                                                 | number                                                                                                                            | `undefined`                                         |
| scale                         | Scales input volume by n. This just multiplies the PCM data (after it has been converted to floating point) by n.                                                                                                                                                                                                                                                                                                             | number                                                                                                                            | `1`                                                 |
| gain                          | Apply a gain adjustment in decibels before encoding. Useful for pre-amplifying or attenuating input without re-rendering PCM.                                                                                                                                                                                                                                                                                                 | `-20` to `+12`                                                                                                                    | `0`                                                 |
| scale-l                       | Same as `scale`, but for left channel only.                                                                                                                                                                                                                                                                                                                                                                                   | number                                                                                                                            | `undefined`                                         |
| scale-r                       | Same as `scale`, but for right channel only.                                                                                                                                                                                                                                                                                                                                                                                  | number                                                                                                                            | `undefined`                                         |
| replaygain-fast               | Compute ReplayGain fast but slightly inaccurately. Details see [LAME man page](https://linux.die.net/man/1/lame).                                                                                                                                                                                                                                                                                                             | boolean                                                                                                                           | `false`                                             |
| replaygain-accurate           | Compute ReplayGain more accurately and find the peak sample. Details see [LAME man page](https://linux.die.net/man/1/lame).                                                                                                                                                                                                                                                                                                   | boolean                                                                                                                           | `false`                                             |
| no-replaygain                 | Disable ReplayGain analysis. By default ReplayGain analysis is enabled. Details see [LAME man page](https://linux.die.net/man/1/lame).                                                                                                                                                                                                                                                                                        | boolean                                                                                                                           | `false`                                             |
| clip-detect                   | Clipping detection.                                                                                                                                                                                                                                                                                                                                                                                                           | boolean                                                                                                                           | `false`                                             |
| preset                        | Use one of the built-in presets. Accepts the named profiles, numeric presets (maps to ABR), or compound forms such as `fast standard`, `fast 192`, or `cbr 256`.                                                                                                                                                                                                                                                           | `medium`, `standard`, `extreme`, `insane`, numeric bitrate `8`-`640`, strings like `fast <preset|bitrate>` or `cbr <bitrate>`     | `undefined`                                         |
| noasm                         | Disable specific assembly optimizations. Quality will not increase, only speed will be reduced.                                                                                                                                                                                                                                                                                                                               | `mmx`, `3dnow` or `sse`                                                                                                           | `undefined` (probably depending on OS)              |
| quality                       | Bitrate is of course the main influence on quality. The higher the bitrate, the higher the quality. But for a given bitrate, we have a choice of algorithms to determine the best scalefactors and Huffman encoding (noise shaping).                                                                                                                                                                                          | `0` (best) to `9` (worst)                                                                                                         | `5`                                                 |
| quality-high                  | Shortcut for `quality = 2` (same as CLI `-h`).                                                                                                                                                                                                                                                                                                                                                                                | boolean                                                                                                                           | `false`                                             |
| fast-encoding                 | Shortcut for `quality = 7` (same as CLI `-f`).                                                                                                                                                                                                                                                                                                                                                                                | boolean                                                                                                                           | `false`                                             |
| bitrate                       | For MPEG-1 (sampling frequencies of 32, 44.1 and 48 kHz): n = `32`, `40`, `48`, `56`, `64`, `80`, `96`, `112`, `128`, `160`, `192`, `224`, `256`, `320`; For MPEG-2 (sampling frequencies of 16, 22.05 and 24 kHz): n = `8`, `16`, `24`, `32`, `40`, `48`, `56`, `64`, `80`, `96`, `112`, `128`, `144`, `160`; For MPEG-2.5 (sampling frequencies of 8, 11.025 and 12 kHz): n = `8`, `16`, `24`, `32`, `40`, `48`, `56`, `64` | See description                                                                                                                   | `128` for MPEG1 and `64` for MPEG2                  |
| max-bitrate                  | Set the maximum bitrate when using VBR/ABR (CLI `-B`).                                                                                                                                                                                                                                                                                                                                                                         | `8`, `16`, `24`, `32`, `40`, `48`, `56`, `64`, `80`, `96`, `112`, `128`, `144`, `160`, `192`, `224`, `256`, `320`                  | `undefined`                                         |
| force-bitrate                 | Strictly enforce the `bitrate` option. This is mainly for use with hardware players that do not support low bitrate mp3.                                                                                                                                                                                                                                                                                                      | boolean                                                                                                                           | `false`                                             |
| cbr                           | Enforce use of constant bitrate.                                                                                                                                                                                                                                                                                                                                                                                              | boolean                                                                                                                           | `false`                                             |
| abr                           | ABR (average bitrate) options. Turns on encoding with a targeted average bitrate of n kbits, allowing to use frames of different sizes.                                                                                                                                                                                                                                                                                       | `8` to `310`                                                                                                                      | `undefined`                                         |
| vbr                           | Use variable bitrate.                                                                                                                                                                                                                                                                                                                                                                                                         | boolean                                                                                                                           | `false`                                             |
| vbr-old                       | Force the legacy VBR routine (`--vbr-old`).                                                                                                                                                                                                                                                                                                                                                                                  | boolean                                                                                                                           | `false`                                             |
| vbr-new                       | Force the new VBR routine (`--vbr-new`, default in modern LAME).                                                                                                                                                                                                                                                                                                                                                             | boolean                                                                                                                           | `false`                                             |
| vbr-quality                   | Enable `vbr` and specifies the value of VBR quality.                                                                                                                                                                                                                                                                                                                                                                          | `0` (best) to `9` (worst)                                                                                                         | `4`                                                 |
| ignore-noise-in-sfb21         | LAME ignore noise in sfb21, like in CBR.                                                                                                                                                                                                                                                                                                                                                                                      | boolean                                                                                                                           | `false`                                             |
| emp                           | All this does is set a flag in the MP3 header bitstream. If you have a PCM input file where one of the above types of (obsolete) emphasis has been applied, you can set this flag in LAME. Then the mp3 decoder should de-emphasize the output during playback, although most decoders ignore this flag.                                                                                                                      | `n` none, `5` 0/15 microseconds, `c` citt j.17                                                                                    | `n`                                                 |
| mark-as-copyrighted           | Mark the encoded file as being copyrighted.                                                                                                                                                                                                                                                                                                                                                                                   | boolean                                                                                                                           | `false`                                             |
| mark-as-copy                  | Mark the encoded file as being a copy.                                                                                                                                                                                                                                                                                                                                                                                        | boolean                                                                                                                           | `false`                                             |
| crc-error-protection          | Turn on CRC error protection.It will add a cyclic redundancy check (CRC) code in each frame, allowing to detect transmission errors that could occur on the MP3 stream.                                                                                                                                                                                                                                                       | boolean                                                                                                                           | `false`                                             |
| nores                         | Disable the bit reservoir. Each frame will then become independent from previous ones, but the quality will be lower.                                                                                                                                                                                                                                                                                                         | boolean                                                                                                                           | `false`                                             |
| strictly-enforce-ISO          | With this option, LAME will enforce the 7680 bit limitation on total frame size.                                                                                                                                                                                                                                                                                                                                              | boolean                                                                                                                           | `false`                                             |
| priority                      | Adjust process priority when running on Windows or OS/2 (`--priority`).                                                                                                                                                                                                                                                                                                                                                       | `0` (low) to `4` (maximum)                                                                                                        | `undefined`                                         |
| lowpass                       | Set a lowpass filtering frequency in kHz. Frequencies specified one will be cutoff.                                                                                                                                                                                                                                                                                                                                           | number                                                                                                                            | `undefined`                                         |
| lowpass-width                 | Set the width of the lowpass filter in percent.                                                                                                                                                                                                                                                                                                                                                                               | number                                                                                                                            | `15`                                                |
| highpass                      | Set an highpass filtering frequency in kHz.                                                                                                                                                                                                                                                                                                                                                                                   | number                                                                                                                            | `undefined`                                         |
| highpass-width                | Set the width of the highpass filter in percent.                                                                                                                                                                                                                                                                                                                                                                              | number                                                                                                                            | `15`                                                |
| resample                      | Output sampling frequency (for encoding). If not specified, LAME will automatically resample the input when using high compression ratios.                                                                                                                                                                                                                                                                                    | `8`, `11.025`, `12`, `16`, `22.05`, `24`, `32`, `44.1`, `48`                                                                      | `undefined`                                         |
| decode-mp3delay               | Override the encoder delay to use when decoding MP3 files (`--decode-mp3delay`).                                                                                                                                                                                                                                                                                                                                              | number (samples)                                                                                                                  | `undefined`                                         |
| disptime                      | Interval between CLI progress updates. Set to a number of seconds or `false` to skip the automatic `--disptime 1`.                                                                                                                                                                                                                                                                                                         | number (> 0) or `false`                                                                                                          | `1`                                                 |
| silent                        | Suppress all CLI output (`--silent`).                                                                                                                                                                                                                                                                                                                                                                                        | boolean                                                                                                                           | `false`                                             |
| quiet                         | Reduce CLI output (`--quiet`).                                                                                                                                                                                                                                                                                                                                                                                                | boolean                                                                                                                           | `false`                                             |
| verbose                       | Print verbose CLI diagnostics (`--verbose`).                                                                                                                                                                                                                                                                                                                                                                                  | boolean                                                                                                                           | `false`                                             |
| no-histogram                  | Disable the VBR bitrate histogram display (`--nohist`).                                                                                                                                                                                                                                                                                                                                                                        | boolean                                                                                                                           | `false`                                             |
| help                          | Forward `--help`, optionally with a topic (`id3` or `dev`).                                                                                                                                                                                                                                                                                                                                                                    | boolean or `'id3'`, `'dev'`                                                                                                       | `false`                                             |
| usage                         | Forward `--usage`, optionally with a topic (`id3` or `dev`).                                                                                                                                                                                                                                                                                                                                                                   | boolean or `'id3'`, `'dev'`                                                                                                       | `false`                                             |
| longhelp                      | Display the full list of switches (`--longhelp`).                                                                                                                                                                                                                                                                                                                                                                             | boolean                                                                                                                           | `false`                                             |
| version                       | Print LAME version information (`--version`).                                                                                                                                                                                                                                                                                                                                                                                 | boolean                                                                                                                           | `false`                                             |
| license                       | Print LAME license information (`--license`).                                                                                                                                                                                                                                                                                                                                                                                 | boolean                                                                                                                           | `false`                                             |
| meta                          | Meta data for MP3, including standard tags and a `custom` helper for arbitrary ID3v2 frames.                                                                                                                                                                                                                                                                                                                                  | Object                                                                                                                            | `undefined`                                         |

_Meta options_

| Option            | Description                                                                   | Values  | Default     |
| ----------------- | ----------------------------------------------------------------------------- | ------- | ----------- |
| title             | Set title tag (max 30 chars for version 1 tag).                               | String  | `undefined` |
| artist            | Set artist tag (max 30 chars for version 1 tag).                              | String  | `undefined` |
| album             | Set album tag (max 30 chars for version 1 tag).                               | String  | `undefined` |
| year              | Set year tag.                                                                 | String  | `undefined` |
| comment           | Set user-defined text (max 30 chars for v1 tag, 28 for v1.1).                 | String  | `undefined` |
| track             | Set track tag, with or without number of total tracks.                        | String  | `undefined` |
| genre             | Set genre tag (max 30 chars for version 1 tag).                               | String  | `undefined` |
| artwork           | Set album artwork image (path to jpeg/png/gif file, v2.3 tag).                | String  | `undefined` |
| add-id3v2         | Force addition of version 2 tag.                                              | boolean | `false`     |
| id3v1-only        | Add only a version 1 tag.                                                     | boolean | `false`     |
| id3v2-only        | Add only a version 2 tag.                                                     | boolean | `false`     |
| id3v2-latin1      | Add meta options in ISO-8859-1 text encoding.                                 | boolean | `false`     |
| id3v2-utf16       | Add meta options in unicode text encoding.                                    | boolean | `false`     |
| space-id3v1       | Pad version 1 tag with spaces instead of nulls.                               | boolean | `false`     |
| pad-id3v2         | Same as `pad-id3v2-size` value `128`                                          | boolean | `false`     |
| pad-id3v2-size    | Adds version 2 tag, pad with extra "num" bytes.                               | number  | `undefined` |
| ignore-tag-errors | Ignore errors in values passed for tags, use defaults in case an error occurs | boolean | `false`     |
| genre-list        | Print alphabetically sorted ID3 genre list and exit                           | string  | `undefined` |
| custom            | Supply custom ID3v2 frames. Accepts an object map, array of `id=value` strings, tuples, or `{ id, value }` objects. | object or array | `undefined` |

Option description text from [LAME man page](https://linux.die.net/man/1/lame). Based on LAME version [3.99.5](https://sourceforge.net/projects/lame/files/lame/3.99/) from Feb 28, 2012.
