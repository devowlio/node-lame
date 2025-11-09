import { describe, expect, it } from "vitest";
import { LameOptions } from "../../src/core/lame-options";
import type {
    BitRate,
    BitWidth,
    ChannelMode,
    LameOptionsBag,
    NoAsm,
    PriorityLevel,
} from "../../src/types";

const buildOptions = (overrides: Partial<LameOptionsBag>) =>
    new LameOptions({
        output: "buffer",
        ...overrides,
    } as LameOptionsBag);

describe("LameOptions", () => {
    it("throws when output option is missing", () => {
        expect(() => new LameOptions({} as LameOptionsBag)).toThrow(
            "lame: Invalid option: 'output' is required",
        );
    });

    it("builds arguments for comprehensive configuration", () => {
        const options: LameOptionsBag = {
            output: "buffer",
            raw: true,
            "swap-bytes": true,
            "swap-channel": true,
            gain: 3,
            sfreq: 44.1,
            bitwidth: 16,
            signed: true,
            unsigned: true,
            "little-endian": true,
            "big-endian": true,
            mp1Input: true,
            mp2Input: true,
            mp3Input: true,
            mode: "j",
            "to-mono": true,
            "channel-different-block-sizes": true,
            freeformat: true,
            "disable-info-tag": true,
            "nogap": ["./track-1.wav", "./track-2.wav"],
            "nogapout": "./gapless-out",
            "nogaptags": true,
            "out-dir": "./exports",
            comp: 1.2,
            scale: 0.8,
            "scale-l": 0.9,
            "scale-r": 0.95,
            "replaygain-fast": true,
            "replaygain-accurate": true,
            "no-replaygain": true,
            "clip-detect": true,
            preset: "fast 128",
            noasm: "sse",
            quality: 4,
            "quality-high": true,
            "fast-encoding": true,
            bitrate: 192,
            "max-bitrate": 256,
            "force-bitrate": true,
            cbr: true,
            abr: 192,
            vbr: true,
            "vbr-quality": 3,
            "vbr-old": true,
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
            "decode-mp3delay": 576,
            priority: 2,
            disptime: 2,
            silent: true,
            help: "dev",
            usage: "id3",
            longhelp: true,
            version: true,
            license: true,
            "no-histogram": true,
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
                custom: {
                    TXXX: "CustomValue",
                },
            },
        };

        const builder = new LameOptions(options);
        const args = builder.getArguments();

        const expectedSubset = [
            "-r",
            "-x",
            "--swap-channel",
            "--gain",
            "3",
            "-s",
            "44.1",
            "--bitwidth",
            "16",
            "--unsigned",
            "--big-endian",
            "--mp1input",
            "--mp2input",
            "--mp3input",
            "-m",
            "j",
            "-a",
            "-d",
            "--freeformat",
            "-t",
            "--nogap",
            "./track-1.wav",
            "./track-2.wav",
            "--nogapout",
            "./gapless-out",
            "--nogaptags",
            "--out-dir",
            "./exports",
            "--comp",
            "--scale",
            "0.8",
            "--scale-l",
            "0.9",
            "--scale-r",
            "0.95",
            "--replaygain-fast",
            "--replaygain-accurate",
            "-F",
            "--preset",
            "fast",
            "128",
            "--cbr",
            "--abr",
            "192",
            "-V",
            "3",
            "--vbr-old",
            "--noreplaygain",
            "--clipdetect",
            "-h",
            "-f",
            "-p",
            "-B",
            "256",
            "--nores",
            "--strictly-enforce-ISO",
            "--lowpass",
            "18",
            "--highpass",
            "3",
            "--resample",
            "32",
            "--decode-mp3delay",
            "576",
            "--priority",
            "2",
            "--disptime",
            "2",
            "--silent",
            "--help",
            "dev",
            "--usage",
            "id3",
            "--longhelp",
            "--version",
            "--license",
            "--nohist",
            "--tt",
            "Title",
            "--ta",
            "Artist",
            "--id3v2-utf16",
            "--genre-list",
            "Rock,Pop",
            "--tv",
            "TXXX=CustomValue",
        ];

        expect(args).toEqual(expect.arrayContaining(expectedSubset));
    });

    it("ignores falsy boolean options", () => {
        const builder = new LameOptions({
            output: "buffer",
            raw: false,
            "swap-bytes": false,
            "swap-channel": false,
            signed: false,
            unsigned: false,
            "little-endian": false,
            "big-endian": false,
            mp1Input: false,
            mp2Input: false,
            mp3Input: false,
            "to-mono": false,
            "channel-different-block-sizes": false,
            freeformat: false,
            "disable-info-tag": false,
            "nogaptags": false,
            "replaygain-fast": false,
            "replaygain-accurate": false,
            "no-replaygain": false,
            "clip-detect": false,
            preset: "standard",
            noasm: "sse",
            "quality-high": false,
            "fast-encoding": false,
            "force-bitrate": false,
            cbr: false,
            abr: 192,
            vbr: false,
            "vbr-old": false,
            "vbr-new": false,
            "ignore-noise-in-sfb21": false,
            "crc-error-protection": false,
            nores: false,
            "strictly-enforce-ISO": false,
            "mark-as-copyrighted": false,
            "mark-as-copy": false,
            silent: false,
            quiet: false,
            verbose: false,
            "no-histogram": false,
            longhelp: false,
            version: false,
            license: false,
            help: false,
            usage: false,
        } as LameOptionsBag);

        const args = builder.getArguments();
        expect(args).not.toContain("--unsigned");
        expect(args).not.toContain("--mp2input");
    });

    it("throws for invalid numeric option values", () => {
        expect(
            () =>
                new LameOptions({
                    output: "file",
                    quality: 20,
                } as unknown as LameOptionsBag),
        ).toThrow("lame: Invalid option: 'quality' is not in range of 0 to 9.");

        expect(
            () =>
                new LameOptions({
                    output: "file",
                    sfreq: 9,
                } as unknown as LameOptionsBag),
        ).toThrow("lame: Invalid option: 'sfreq' is not in range of 8, 11.025, 12, 16, 22.05, 24, 32, 44.1 or 48.");
    });

    it("throws for unknown meta properties", () => {
        expect(
            () =>
                new LameOptions({
                    output: "buffer",
                    meta: {
                        output: "invalid",
                } as unknown as LameOptionsBag["meta"],
            } as LameOptionsBag),
        ).toThrow("lame: Invalid option: 'meta' unknown property 'output'");
    });

    it("throws when meta payload is not an object", () => {
        expect(
            () =>
                new LameOptions({
                    output: "buffer",
                    meta: "invalid",
                } as unknown as LameOptionsBag),
        ).toThrow("lame: Invalid option: 'meta' must be an object.");
    });

    it("throws when resample value is out of range", () => {
        expect(
            () =>
                new LameOptions({
                    output: "buffer",
                    resample: 20,
                } as unknown as LameOptionsBag),
        ).toThrow(
            "lame: Invalid option: 'resample' is not in range of 8, 11.025, 12, 16, 22.05, 24, 32, 44.1 or 48.",
        );
    });

    it("supports artwork and pad-id3v2 metadata flags", () => {
        const builder = new LameOptions({
            output: "buffer",
            meta: {
                artwork: "/tmp/cover.jpg",
                "pad-id3v2": true,
                "pad-id3v2-size": 8,
            },
        } as LameOptionsBag);

        const args = builder.getArguments();
        expect(args).toContain("--ti");
        expect(args).toContain("/tmp/cover.jpg");
        expect(args).toContain("--pad-id3v2");
        expect(args).toContain("--pad-id3v2-size");
        expect(args).toContain("8");
    });

    it("throws for unsupported emp emphasis values", () => {
        expect(
            () =>
                new LameOptions({
                    output: "buffer",
                    emp: "x",
                } as unknown as LameOptionsBag),
        ).toThrow(
            "lame: Invalid option: 'emp' is not in range of 'n', 5 or 'c'.",
        );
    });

    it("enables copyright flags when requested", () => {
        const builder = new LameOptions({
            output: "buffer",
            "mark-as-copyrighted": true,
            "mark-as-copy": true,
        } as LameOptionsBag);

        const args = builder.getArguments();
        expect(args).toContain("-c");
        expect(args).toContain("-o");
    });

    it("throws for unexpected option keys", () => {
        expect(() =>
            new LameOptions({
                output: "buffer",
                // @ts-expect-error intentionally invalid option key for coverage
                unexpected: true,
            }),
        ).toThrow("Unknown parameter unexpected");
    });

    it.each([8, 16, 24, 32])(
        "accepts supported bitwidth %s",
        (bitwidthValue) => {
            expect(() =>
                buildOptions({ bitwidth: bitwidthValue as BitWidth }),
            ).not.toThrow();
        },
    );

    it.each(["s", "j", "f", "d", "m", "l", "r", "a"])(
        "accepts valid mode %s",
        (modeValue) => {
            expect(() =>
                buildOptions({ mode: modeValue as ChannelMode }),
            ).not.toThrow();
        },
    );

    it("accepts freeformat flag", () => {
        expect(() => buildOptions({ freeformat: true })).not.toThrow();
        expect(() => buildOptions({ freeformat: false })).not.toThrow();
    });

    it("accepts freeformat string aliases for backwards compatibility", () => {
        expect(() => buildOptions({ freeformat: "LAME" as unknown as boolean })).not.toThrow();
    });

    it("throws for unsupported freeformat string values", () => {
        expect(() => buildOptions({ freeformat: "Unknown" as unknown as boolean })).toThrow(
            "lame: Invalid option: 'freeformat' string value must be one of 'FreeAmp', 'in_mpg123', 'l3dec', 'LAME', 'MAD'.",
        );
    });

    it.each([
        "medium",
        "standard",
        "extreme",
        "insane",
        "fast 128",
        "cbr 192",
    ])("accepts preset %s", (presetValue) => {
        expect(() => buildOptions({ preset: presetValue as string })).not.toThrow();
    });

    it("accepts numeric preset", () => {
        expect(() => buildOptions({ preset: 192 })).not.toThrow();
    });

    it.each(["mmx", "3dnow", "sse"])("accepts noasm %s", (value) => {
        expect(() => buildOptions({ noasm: value as NoAsm })).not.toThrow();
    });

    it.each([8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256, 320])(
        "accepts bitrate %s",
        (bitrateValue) => {
            expect(() =>
                buildOptions({ bitrate: bitrateValue as BitRate }),
            ).not.toThrow();
        },
    );

    it("throws for invalid bitwidth values", () => {
        expect(() => buildOptions({ bitwidth: 12 as unknown as BitWidth })).toThrow(
            "lame: Invalid option: 'sfreq' is not in range of 8, 16, 24 or 32.",
        );
    });

    it("throws for invalid mode values", () => {
        expect(() => buildOptions({ mode: "x" as unknown as ChannelMode })).toThrow(
            "lame: Invalid option: 'mode' is not in range of 's', 'j', 'f', 'd', 'm', 'l', 'r' or 'a'.",
        );
    });

    it("throws for invalid preset values", () => {
        expect(() => buildOptions({ preset: "fast" as unknown as string })).toThrow(
            "lame: Invalid option: 'preset' must be a supported preset keyword, numeric bitrate, or preset tuple like 'fast <value>' or 'cbr <bitrate>'.",
        );
        expect(() => buildOptions({ preset: true as unknown as string })).toThrow(
            "lame: Invalid option: 'preset' must be a supported preset keyword, numeric bitrate, or preset tuple like 'fast <value>' or 'cbr <bitrate>'.",
        );
        expect(() => buildOptions({ preset: "fast foo" as unknown as string })).toThrow(
            "lame: Invalid option: 'preset' must be a supported preset keyword, numeric bitrate, or preset tuple like 'fast <value>' or 'cbr <bitrate>'.",
        );
    });

    it("throws when nogap array is invalid", () => {
        expect(() => buildOptions({ nogap: [] })).toThrow(
            "lame: Invalid option: 'nogap' must be a non-empty array of file paths.",
        );
    });

    it("throws when freeformat receives unsupported type", () => {
        expect(() => buildOptions({ freeformat: 123 as unknown as boolean })).toThrow(
            "lame: Invalid option: 'freeformat' must be boolean.",
        );
    });

    it("throws when nogap entries are not strings", () => {
        expect(() => buildOptions({ nogap: [123 as unknown as string] })).toThrow(
            "lame: Invalid option: 'nogap' must be a non-empty array of file paths.",
        );
    });

    it("throws when nogapout is empty", () => {
        expect(() => buildOptions({ "nogapout": "   " })).toThrow(
            "lame: Invalid option: 'nogapout' must be a non-empty string path.",
        );
    });

    it("throws when nogaptags is not boolean", () => {
        expect(() => buildOptions({ "nogaptags": "yes" as unknown as boolean })).toThrow(
            "lame: Invalid option: 'nogaptags' must be boolean.",
        );
    });

    it("throws when nogaptags receives true but returns expected flag", () => {
        const builder = buildOptions({ "nogaptags": true });
        expect(builder.getArguments()).toContain("--nogaptags");
    });

    it("throws when out-dir is invalid", () => {
        expect(() => buildOptions({ "out-dir": "" })).toThrow(
            "lame: Invalid option: 'out-dir' must be a non-empty string path.",
        );
    });

    it("throws when gain is outside the allowed range", () => {
        expect(() => buildOptions({ gain: 30 })).toThrow(
            "lame: Invalid option: 'gain' must be a number between -20 and 12.",
        );
    });

    it("throws for invalid noasm values", () => {
        expect(() => buildOptions({ noasm: "avx" as unknown as NoAsm })).toThrow(
            "lame: Invalid option: 'noasm' is not in range of 'mmx', '3dnow' or 'sse'.",
        );
    });

    it("throws for invalid bitrate values", () => {
        expect(() => buildOptions({ bitrate: 999 as unknown as BitRate })).toThrow(
            "lame: Invalid option: 'bitrate' is not in range of 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256 or 320.",
        );
    });

    it("throws for invalid abr values", () => {
        expect(() => buildOptions({ abr: 400 })).toThrow(
            "lame: Invalid option: 'abr' is not in range of 8 to 310.",
        );
    });

    it("throws for invalid vbr quality values", () => {
        expect(() => buildOptions({ "vbr-quality": 11 })).toThrow(
            "lame: Invalid option: 'vbrQuality' is not in range of 0 to 9.",
        );
    });

    it("throws when decode-mp3delay is not numeric", () => {
        expect(() => buildOptions({ "decode-mp3delay": "foo" as unknown as number })).toThrow(
            "lame: Invalid option: 'decode-mp3delay' must be a finite number.",
        );
    });

    it("throws when priority is outside the supported range", () => {
        expect(() => buildOptions({ priority: 7 as unknown as PriorityLevel })).toThrow(
            "lame: Invalid option: 'priority' must be an integer between 0 and 4.",
        );
    });

    it("throws when disptime is invalid", () => {
        expect(() => buildOptions({ disptime: 0 })).toThrow(
            "lame: Invalid option: 'disptime' must be a positive number of seconds or false to disable progress output.",
        );
    });

    it("throws when silent is not boolean", () => {
        expect(() => buildOptions({ silent: "yes" as unknown as boolean })).toThrow(
            "lame: Invalid option: 'silent' must be boolean.",
        );
    });

    it("throws when quiet is not boolean", () => {
        expect(() => buildOptions({ quiet: "yes" as unknown as boolean })).toThrow(
            "lame: Invalid option: 'quiet' must be boolean.",
        );
    });

    it("throws when verbose is not boolean", () => {
        expect(() => buildOptions({ verbose: "yes" as unknown as boolean })).toThrow(
            "lame: Invalid option: 'verbose' must be boolean.",
        );
    });

    it("throws when longhelp is not boolean", () => {
        expect(() => buildOptions({ longhelp: "yes" as unknown as boolean })).toThrow(
            "lame: Invalid option: 'longhelp' must be boolean.",
        );
    });

    it("maps verbosity toggles when provided to constructor", () => {
        const builder = new LameOptions({
            output: "buffer",
            quiet: true,
            verbose: true,
            longhelp: true,
        } as LameOptionsBag);

        const args = builder.getArguments();
        expect(args).toContain("--quiet");
        expect(args).toContain("--verbose");
        expect(args).toContain("--longhelp");
    });

    it("throws when version is not boolean", () => {
        expect(() => buildOptions({ version: "yes" as unknown as boolean })).toThrow(
            "lame: Invalid option: 'version' must be boolean.",
        );
    });

    it("throws when license is not boolean", () => {
        expect(() => buildOptions({ license: "yes" as unknown as boolean })).toThrow(
            "lame: Invalid option: 'license' must be boolean.",
        );
    });

    it("throws when no-histogram is not boolean", () => {
        expect(() => buildOptions({ "no-histogram": "yes" as unknown as boolean })).toThrow(
            "lame: Invalid option: 'no-histogram' must be boolean.",
        );
    });

    it("returns undefined for false verbosity toggles", () => {
        const builder = new LameOptions({ output: "buffer" } as LameOptionsBag);
        const asAny = builder as unknown as Record<string, (value: unknown) => unknown>;

        expect(asAny.silent(false)).toBeUndefined();
        expect(asAny.silent(undefined)).toBeUndefined();
        expect(asAny.quiet(false)).toBeUndefined();
        expect(asAny.quiet(undefined)).toBeUndefined();
        expect(asAny.quiet(true)).toEqual(["--quiet"]);
        expect(asAny.verbose(false)).toBeUndefined();
        expect(asAny.verbose(undefined)).toBeUndefined();
        expect(asAny.verbose(true)).toEqual(["--verbose"]);
        expect(asAny.longHelp(false)).toBeUndefined();
        expect(asAny.longHelp(undefined)).toBeUndefined();
        expect(asAny.longHelp(true)).toEqual(["--longhelp"]);
    });

    it("returns undefined for optional numeric and toggle helpers when omitted", () => {
        const builder = new LameOptions({ output: "buffer" } as LameOptionsBag);
        const asAny = builder as unknown as Record<string, (value: unknown) => unknown>;

        expect(asAny.gain(undefined)).toBeUndefined();
        expect(asAny.freeformat(undefined)).toBeUndefined();
        expect(asAny.freeformat(true)).toEqual(["--freeformat"]);
        expect(asAny.freeformat("LAME")).toEqual(["--freeformat"]);
        expect(asAny.nogap(null)).toBeUndefined();
        expect(asAny.nogapout(null)).toBeUndefined();
        expect(asAny.outDir(null)).toBeUndefined();
        expect(asAny.preset(null)).toBeUndefined();
        expect(asAny.preset(192)).toEqual(["--preset", "192"]);
        expect(asAny.preset("standard")).toEqual(["--preset", "standard"]);
        expect(asAny.preset("fast 128")).toEqual(["--preset", "fast", "128"]);
        expect(asAny.preset("cbr 256")).toEqual(["--preset", "cbr", "256"]);
        expect(() => asAny.preset("   ")).toThrow(
            "lame: Invalid option: 'preset' cannot be empty.",
        );
        expect(asAny.qualityHigh(false)).toBeUndefined();
        expect(asAny.qualityHigh(true)).toEqual(["-h"]);
        expect(() => asAny.qualityHigh("y" as unknown as boolean)).toThrow(
            "lame: Invalid option: 'quality-high' must be boolean.",
        );
        expect(asAny.fastEncoding(false)).toBeUndefined();
        expect(asAny.fastEncoding(true)).toEqual(["-f"]);
        expect(() => asAny.fastEncoding("y" as unknown as boolean)).toThrow(
            "lame: Invalid option: 'fast-encoding' must be boolean.",
        );
        expect(asAny.maxBitrate(undefined)).toBeUndefined();
        expect(asAny.maxBitrate(192)).toEqual(["-B", "192"]);
        expect(() => asAny.maxBitrate(999)).toThrow(
            "lame: Invalid option: 'max-bitrate' is not in range of 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256 or 320.",
        );
        expect(asAny.vbrOld(false)).toBeUndefined();
        expect(asAny.vbrOld(true)).toEqual(["--vbr-old"]);
        expect(() => asAny.vbrOld("yes" as unknown as boolean)).toThrow(
            "lame: Invalid option: 'vbr-old' must be boolean.",
        );
        expect(asAny.vbrNew(false)).toBeUndefined();
        expect(asAny.vbrNew(true)).toEqual(["--vbr-new"]);
        expect(() => asAny.vbrNew("yes" as unknown as boolean)).toThrow(
            "lame: Invalid option: 'vbr-new' must be boolean.",
        );
        expect(asAny.decodeMp3Delay(null)).toBeUndefined();
        expect(() => asAny.decodeMp3Delay("foo" as unknown as number)).toThrow(
            "lame: Invalid option: 'decode-mp3delay' must be a finite number.",
        );
        expect(asAny.priority(undefined)).toBeUndefined();
        expect(() => asAny.priority(9 as unknown as number)).toThrow(
            "lame: Invalid option: 'priority' must be an integer between 0 and 4.",
        );
        expect(asAny.disptime(undefined)).toBeUndefined();
        expect(asAny.disptime(4)).toEqual(["--disptime", "4"]);
        expect(() => asAny.disptime(0)).toThrow(
            "lame: Invalid option: 'disptime' must be a positive number of seconds or false to disable progress output.",
        );
    });

    it("returns help flag when called with boolean true", () => {
        const builder = buildOptions({ help: true });
        expect(builder.getArguments()).toContain("--help");
    });

    it("throws for invalid help topic", () => {
        expect(() => buildOptions({ help: "foo" as unknown as boolean })).toThrow(
            "lame: Invalid option: 'help' must be boolean or one of 'id3', 'dev'.",
        );
    });

    it("returns usage flag when called with boolean true", () => {
        const builder = buildOptions({ usage: true });
        expect(builder.getArguments()).toContain("--usage");
    });

    it("throws when usage topic is invalid", () => {
        expect(() => buildOptions({ usage: "foo" as unknown as boolean })).toThrow(
            "lame: Invalid option: 'usage' must be boolean or one of 'id3', 'dev'.",
        );
    });

    it("accepts custom ID3 frames via array input", () => {
        const builder = new LameOptions({
            output: "buffer",
            meta: {
                custom: [
                    "TIT2=Song",
                    ["TALB", "Album"],
                    { id: "TPE1", value: "Artist" },
                ],
            },
        } as LameOptionsBag);

        const args = builder.getArguments();
        expect(args.filter((item) => item === "--tv")).toHaveLength(3);
    });

    it("throws when custom frame string misses value delimiter", () => {
        expect(() =>
            new LameOptions({
                output: "buffer",
                meta: { custom: ["INVALID"] },
            } as LameOptionsBag),
        ).toThrow(
            "lame: Invalid option: 'meta.custom' array entries must be 'id=value'.",
        );
    });

    it("ignores null custom metadata payloads", () => {
        const builder = new LameOptions({
            output: "buffer",
            meta: { custom: null },
        } as unknown as LameOptionsBag);

        expect(builder.getArguments()).not.toContain("--tv");
    });

    it("throws when custom frame id is empty", () => {
        expect(() =>
            new LameOptions({
                output: "buffer",
                meta: { custom: [["", "value"]] },
            } as LameOptionsBag),
        ).toThrow(
            "lame: Invalid option: 'meta.custom' frame id must be a non-empty string.",
        );
    });

    it("maps pad-id3v2-size metadata to CLI arguments", () => {
        const builder = new LameOptions({
            output: "buffer",
            meta: {
                "pad-id3v2-size": 256,
            },
        } as LameOptionsBag);

        const args = builder.getArguments();
        expect(args).toContain("--pad-id3v2-size");
        expect(args).toContain("256");
    });

    it("throws when custom array contains unsupported entry type", () => {
        expect(() =>
            new LameOptions({
                output: "buffer",
                meta: { custom: [true] },
            } as unknown as LameOptionsBag),
        ).toThrow(
            "lame: Invalid option: 'meta.custom' array entries must be strings, tuples, or objects with id/value.",
        );
    });

    it("throws for invalid custom meta payload", () => {
        expect(() =>
            new LameOptions({
                output: "buffer",
                meta: {
                    custom: 42,
                },
            } as unknown as LameOptionsBag),
        ).toThrow(
            "lame: Invalid option: 'meta.custom' must be an array or object.",
        );
    });

    it("disables default disptime when false", () => {
        const builder = new LameOptions({
            output: "buffer",
            disptime: false,
        } as LameOptionsBag);

        expect(builder.shouldUseDefaultDisptime()).toBe(false);
        expect(builder.getArguments()).not.toContain("--disptime");
    });
});
