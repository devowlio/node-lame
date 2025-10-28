import { describe, expect, it } from "vitest";
import { LameOptions } from "../../src/core/lame-options";
import type { LameOptionsBag } from "../../src/types";

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
        };

        const builder = new LameOptions(options);
        const args = builder.getArguments();

        const expectedSubset = [
            "-r",
            "-x",
            "-s",
            "44.1",
            "--bitwidth",
            "16",
            "--unsigned",
            "--big-endian",
            "--mp2input",
            "--mp3input",
            "-m",
            "j",
            "-a",
            "-d",
            "-t",
            "--comp",
            "--scale-l",
            "-F",
            "--cbr",
            "--abr",
            "192",
            "-V",
            "3",
            "--noreplaygain",
            "--clipdetect",
            "-p",
            "--nores",
            "--strictly-enforce-ISO",
            "--lowpass",
            "18",
            "--highpass",
            "3",
            "--resample",
            "32",
            "--tt",
            "Title",
            "--ta",
            "Artist",
            "--id3v2-utf16",
            "--genre-list",
            "Rock,Pop",
        ];

        expect(args).toEqual(expect.arrayContaining(expectedSubset));
    });

    it("ignores falsy boolean options", () => {
        const builder = new LameOptions({
            output: "buffer",
            raw: false,
            "swap-bytes": false,
            signed: false,
            unsigned: false,
            "little-endian": false,
            "big-endian": false,
            mp2Input: false,
            mp3Input: false,
            "to-mono": false,
            "channel-different-block-sizes": false,
            freeformat: "LAME",
            "disable-info-tag": false,
            "replaygain-fast": false,
            "replaygain-accurate": false,
            "no-replaygain": false,
            "clip-detect": false,
            preset: "standard",
            noasm: "sse",
            "force-bitrate": false,
            cbr: false,
            abr: 192,
            vbr: false,
            "ignore-noise-in-sfb21": false,
            "crc-error-protection": false,
            nores: false,
            "strictly-enforce-ISO": false,
            "mark-as-copyrighted": false,
            "mark-as-copy": false,
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
            expect(() => buildOptions({ bitwidth: bitwidthValue })).not.toThrow();
        },
    );

    it.each(["s", "j", "f", "d", "m", "l", "r"])(
        "accepts valid mode %s",
        (modeValue) => {
            expect(() => buildOptions({ mode: modeValue })).not.toThrow();
        },
    );

    it.each(["FreeAmp", "in_mpg123", "l3dec", "LAME", "MAD"])(
        "accepts valid freeformat %s",
        (freeformatValue) => {
            expect(() => buildOptions({ freeformat: freeformatValue })).not.toThrow();
        },
    );

    it.each(["medium", "standard", "extreme", "insane"])(
        "accepts preset %s",
        (presetValue) => {
            expect(() => buildOptions({ preset: presetValue })).not.toThrow();
        },
    );

    it.each(["mmx", "3dnow", "sse"])("accepts noasm %s", (value) => {
        expect(() => buildOptions({ noasm: value })).not.toThrow();
    });

    it.each([8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256, 320])(
        "accepts bitrate %s",
        (bitrateValue) => {
            expect(() => buildOptions({ bitrate: bitrateValue })).not.toThrow();
        },
    );

    it("throws for invalid bitwidth values", () => {
        expect(() => buildOptions({ bitwidth: 12 as unknown as number })).toThrow(
            "lame: Invalid option: 'sfreq' is not in range of 8, 16, 24 or 32.",
        );
    });

    it("throws for invalid mode values", () => {
        expect(() => buildOptions({ mode: "x" as unknown as string })).toThrow(
            "lame: Invalid option: 'mode' is not in range of 's', 'j', 'f', 'd', 'm', 'l' or 'r'.",
        );
    });

    it("throws for invalid freeformat values", () => {
        expect(
            () => buildOptions({ freeformat: "Unknown" as unknown as string }),
        ).toThrow(
            "lame: Invalid option: 'mode' is not in range of 'FreeAmp', 'in_mpg123', 'l3dec', 'LAME', 'MAD'.",
        );
    });

    it("throws for invalid preset values", () => {
        expect(() => buildOptions({ preset: "fast" as unknown as string })).toThrow(
            "lame: Invalid option: 'mode' is not in range of 'medium', 'standard', 'extreme' or 'insane'.",
        );
    });

    it("throws for invalid noasm values", () => {
        expect(() => buildOptions({ noasm: "avx" as unknown as string })).toThrow(
            "lame: Invalid option: 'noasm' is not in range of 'mmx', '3dnow' or 'sse'.",
        );
    });

    it("throws for invalid bitrate values", () => {
        expect(() => buildOptions({ bitrate: 999 })).toThrow(
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
});
