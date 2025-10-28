import type { LameOptionsBag } from "../types";

/**
 * Translates option objects into the argument list expected by the LAME CLI.
 */
class LameOptions {
    private readonly args: string[] = [];
    /**
     * Validate all options and build argument array for binary
     * @param {Object} options
     */
    constructor(options: LameOptionsBag) {
        // Output is required
        if (options["output"] == undefined) {
            throw new Error("lame: Invalid option: 'output' is required");
        }

        // Save options as arguments
        const entries = Object.entries(options) as Array<
            [keyof LameOptionsBag, LameOptionsBag[keyof LameOptionsBag]]
        >;

        for (const [key, value] of entries) {
            let arg: Array<string | number> | undefined;

            switch (key) {
                case "output":
                    continue;
                case "raw":
                    arg = this.raw(value);
                    break;
                case "swap-bytes":
                    arg = this.swapBytes(value);
                    break;
                case "sfreq":
                    arg = this.sfreq(value);
                    break;
                case "bitwidth":
                    arg = this.bitwidth(value);
                    break;
                case "signed":
                    arg = this.signed(value);
                    break;
                case "unsigned":
                    arg = this.unsigned(value);
                    break;
                case "little-endian":
                    arg = this.littleEndian(value);
                    break;
                case "big-endian":
                    arg = this.bigEndian(value);
                    break;
                case "mp2Input":
                    arg = this.mp2Input(value);
                    break;
                case "mp3Input":
                    arg = this.mp3Input(value);
                    break;
                case "mode":
                    arg = this.mode(value);
                    break;
                case "to-mono":
                    arg = this.toMono(value);
                    break;
                case "channel-different-block-sizes":
                    arg = this.channelDifferentBlockSize(value);
                    break;
                case "freeformat":
                    arg = this.freeformat(value);
                    break;
                case "disable-info-tag":
                    arg = this.disableInfoTag(value);
                    break;
                case "comp":
                    arg = this.comp(value);
                    break;
                case "scale":
                    arg = this.scale(value);
                    break;
                case "scale-l":
                    arg = this.scaleL(value);
                    break;
                case "scale-r":
                    arg = this.scaleR(value);
                    break;
                case "replaygain-fast":
                    arg = this.replaygainFast(value);
                    break;
                case "replaygain-accurate":
                    arg = this.replaygainAccurate(value);
                    break;
                case "no-replaygain":
                    arg = this.noreplaygain(value);
                    break;
                case "clip-detect":
                    arg = this.clipDetect(value);
                    break;
                case "preset":
                    arg = this.preset(value);
                    break;
                case "noasm":
                    arg = this.noasm(value);
                    break;
                case "quality":
                    arg = this.quality(value);
                    break;
                case "bitrate":
                    arg = this.bitrate(value);
                    break;
                case "force-bitrate":
                    arg = this.forceBitrate(value);
                    break;
                case "cbr":
                    arg = this.cbr(value);
                    break;
                case "abr":
                    arg = this.abr(value);
                    break;
                case "vbr":
                    arg = this.vbr(value);
                    break;
                case "vbr-quality":
                    arg = this.vbrQuality(value);
                    break;
                case "ignore-noise-in-sfb21":
                    arg = this.ignoreNoiseInSfb21(value);
                    break;
                case "emp":
                    arg = this.emp(value);
                    break;
                case "mark-as-copyrighted":
                    arg = this.markAsCopyrighted(value);
                    break;
                case "mark-as-copy":
                    arg = this.markAsCopy(value);
                    break;
                case "crc-error-protection":
                    arg = this.crcErrorProtection(value);
                    break;
                case "nores":
                    arg = this.nores(value);
                    break;
                case "strictly-enforce-ISO":
                    arg = this.strictlyEnforceIso(value);
                    break;
                case "lowpass":
                    arg = this.lowpass(value);
                    break;
                case "lowpass-width":
                    arg = this.lowpassWidth(value);
                    break;
                case "highpass":
                    arg = this.highpass(value);
                    break;
                case "highpass-width":
                    arg = this.highpassWidth(value);
                    break;
                case "resample":
                    arg = this.resample(value);
                    break;
                case "meta":
                    arg = this.meta(value);
                    break;
                default:
                    throw new Error("Unknown parameter " + key);
            }

            if (Array.isArray(arg)) {
                this.args.push(...arg.map((item) => String(item)));
            }
        }
    }

    /**
     * Get all arguments for binary
     */
    public getArguments() {
        return this.args;
    }

    private raw(value: unknown) {
        if (value == true) {
            return [`-r`];
        } else {
            return undefined;
        }
    }

    private swapBytes(value: unknown) {
        if (value == true) {
            return [`-x`];
        } else {
            return undefined;
        }
    }

    private sfreq(value: unknown) {
        if (
            value == 8 ||
            value == 11.025 ||
            value == 12 ||
            value == 16 ||
            value == 22.05 ||
            value == 24 ||
            value == 32 ||
            value == 44.1 ||
            value == 48
        ) {
            return [`-s`, String(value)];
        } else {
            throw new Error(
                "lame: Invalid option: 'sfreq' is not in range of 8, 11.025, 12, 16, 22.05, 24, 32, 44.1 or 48.",
            );
        }
    }

    private bitwidth(value: unknown) {
        if (value == 8 || value == 16 || value == 24 || value == 32) {
            return [`--bitwidth`, String(value)];
        } else {
            throw new Error(
                "lame: Invalid option: 'sfreq' is not in range of 8, 16, 24 or 32.",
            );
        }
    }

    private signed(value: unknown) {
        if (value == true) {
            return [`--signed`];
        } else {
            return undefined;
        }
    }

    private unsigned(value: unknown) {
        if (value == true) {
            return [`--unsigned`];
        } else {
            return undefined;
        }
    }

    private littleEndian(value: unknown) {
        if (value == true) {
            return [`--little-endian`];
        } else {
            return undefined;
        }
    }

    private bigEndian(value: unknown) {
        if (value == true) {
            return [`--big-endian`];
        } else {
            return undefined;
        }
    }

    private mp2Input(value: unknown) {
        if (value == true) {
            return [`--mp2input`];
        } else {
            return undefined;
        }
    }

    private mp3Input(value: unknown) {
        if (value == true) {
            return [`--mp3input`];
        } else {
            return undefined;
        }
    }

    private mode(value: unknown) {
        if (
            value == "s" ||
            value == "j" ||
            value == "f" ||
            value == "d" ||
            value == "m" ||
            value == "l" ||
            value == "r"
        ) {
            return [`-m`, String(value)];
        } else {
            throw new Error(
                "lame: Invalid option: 'mode' is not in range of 's', 'j', 'f', 'd', 'm', 'l' or 'r'.",
            );
        }
    }

    private toMono(value: unknown) {
        if (value == true) {
            return [`-a`];
        } else {
            return undefined;
        }
    }

    private channelDifferentBlockSize(value: unknown) {
        if (value == true) {
            return [`-d`];
        } else {
            return undefined;
        }
    }

    private freeformat(value: unknown) {
        if (
            value == "FreeAmp" ||
            value == "in_mpg123" ||
            value == "l3dec" ||
            value == "LAME" ||
            value == "MAD"
        ) {
            return [`--freeformat`, String(value)];
        } else {
            throw new Error(
                "lame: Invalid option: 'mode' is not in range of 'FreeAmp', 'in_mpg123', 'l3dec', 'LAME', 'MAD'.",
            );
        }
    }

    private disableInfoTag(value: unknown) {
        if (value == true) {
            return [`-t`];
        } else {
            return undefined;
        }
    }

    private comp(value: unknown) {
        return [`--comp`, String(value)];
    }

    private scale(value: unknown) {
        return [`--scale`, String(value)];
    }

    private scaleL(value: unknown) {
        return [`--scale-l`, String(value)];
    }

    private scaleR(value: unknown) {
        return [`--scale-r`, String(value)];
    }

    private replaygainFast(value: unknown) {
        if (value == true) {
            return [`--replaygain-fast`];
        } else {
            return undefined;
        }
    }

    private replaygainAccurate(value: unknown) {
        if (value == true) {
            return [`--replaygain-accurate`];
        } else {
            return undefined;
        }
    }

    private noreplaygain(value: unknown) {
        if (value == true) {
            return [`--noreplaygain`];
        } else {
            return undefined;
        }
    }

    private clipDetect(value: unknown) {
        if (value == true) {
            return [`--clipdetect`];
        } else {
            return undefined;
        }
    }

    private preset(value: unknown) {
        if (
            value == "medium" ||
            value == "standard" ||
            value == "extreme" ||
            value == "insane"
        ) {
            return [`--preset`, String(value)];
        } else {
            throw new Error(
                "lame: Invalid option: 'mode' is not in range of 'medium', 'standard', 'extreme' or 'insane'.",
            );
        }
    }

    private noasm(value: unknown) {
        if (value == "mmx" || value == "3dnow" || value == "sse") {
            return [`--noasm`, String(value)];
        } else {
            throw new Error(
                "lame: Invalid option: 'noasm' is not in range of 'mmx', '3dnow' or 'sse'.",
            );
        }
    }

    private quality(value: unknown) {
        if (typeof value === "number" && value >= 0 && value <= 9) {
            return [`-q`, String(value)];
        } else {
            throw new Error(
                "lame: Invalid option: 'quality' is not in range of 0 to 9.",
            );
        }
    }

    private bitrate(value: unknown) {
        if (
            value == 8 ||
            value == 16 ||
            value == 24 ||
            value == 32 ||
            value == 40 ||
            value == 48 ||
            value == 56 ||
            value == 64 ||
            value == 80 ||
            value == 96 ||
            value == 112 ||
            value == 128 ||
            value == 144 ||
            value == 160 ||
            value == 192 ||
            value == 224 ||
            value == 256 ||
            value == 320
        ) {
            return [`-b`, String(value)];
        } else {
            throw new Error(
                "lame: Invalid option: 'bitrate' is not in range of 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256 or 320.",
            );
        }
    }

    private forceBitrate(value: unknown) {
        if (value == true) {
            return [`-F`];
        } else {
            return undefined;
        }
    }

    private cbr(value: unknown) {
        if (value == true) {
            return [`--cbr`];
        } else {
            return undefined;
        }
    }

    private abr(value: unknown) {
        if (typeof value === "number" && value >= 8 && value <= 310) {
            return [`--abr`, String(value)];
        } else {
            throw new Error(
                "lame: Invalid option: 'abr' is not in range of 8 to 310.",
            );
        }
    }

    private vbr(value: unknown) {
        if (value == true) {
            return [`-v`];
        } else {
            return undefined;
        }
    }

    private vbrQuality(value: unknown) {
        if (typeof value === "number" && value >= 0 && value <= 9) {
            return [`-V`, String(value)];
        } else {
            throw new Error(
                "lame: Invalid option: 'vbrQuality' is not in range of 0 to 9.",
            );
        }
    }

    private ignoreNoiseInSfb21(value: unknown) {
        if (value == true) {
            return [`-Y`];
        } else {
            return undefined;
        }
    }

    private emp(value: unknown) {
        if (value == "n" || value == 5 || value == "c") {
            return [`-e`, String(value)];
        } else {
            throw new Error(
                "lame: Invalid option: 'emp' is not in range of 'n', 5 or 'c'.",
            );
        }
    }

    private markAsCopyrighted(value: unknown) {
        if (value == true) {
            return [`-c`];
        } else {
            return undefined;
        }
    }

    private markAsCopy(value: unknown) {
        if (value == true) {
            return [`-o`];
        } else {
            return undefined;
        }
    }

    private crcErrorProtection(value: unknown) {
        if (value == true) {
            return [`-p`];
        } else {
            return undefined;
        }
    }

    private nores(value: unknown) {
        if (value == true) {
            return [`--nores`];
        } else {
            return undefined;
        }
    }

    private strictlyEnforceIso(value: unknown) {
        if (value == true) {
            return [`--strictly-enforce-ISO`];
        } else {
            return undefined;
        }
    }

    private lowpass(value: unknown) {
        return [`--lowpass`, String(value)];
    }

    private lowpassWidth(value: unknown) {
        return [`--lowpass-width`, String(value)];
    }

    private highpass(value: unknown) {
        return [`--highpass`, String(value)];
    }

    private highpassWidth(value: unknown) {
        return [`--highpass-width`, String(value)];
    }

    private resample(value: unknown) {
        if (
            value == 8 ||
            value == 11.025 ||
            value == 12 ||
            value == 16 ||
            value == 22.05 ||
            value == 24 ||
            value == 32 ||
            value == 44.1 ||
            value == 48
        ) {
            return [`--resample`, String(value)];
        } else {
            throw new Error(
                "lame: Invalid option: 'resample' is not in range of 8, 11.025, 12, 16, 22.05, 24, 32, 44.1 or 48.",
            );
        }
    }

    private meta(metaObj: unknown) {
        if (metaObj == null || typeof metaObj !== "object") {
            throw new Error("lame: Invalid option: 'meta' must be an object.");
        }

        const metaRecord = metaObj as Record<string, unknown>;

        for (const key of Object.keys(metaRecord)) {
            const value = metaRecord[key];

            if (
                key == "title" ||
                key == "artist" ||
                key == "album" ||
                key == "year" ||
                key == "comment" ||
                key == "track" ||
                key == "genre" ||
                key == "artwork" ||
                key == "genre-list" ||
                key == "pad-id3v2-size"
            ) {
                let arg0;
                if (key == "title") {
                    arg0 = `--tt`;
                } else if (key == "artist") {
                    arg0 = `--ta`;
                } else if (key == "album") {
                    arg0 = `--tl`;
                } else if (key == "year") {
                    arg0 = `--ty`;
                } else if (key == "comment") {
                    arg0 = `--tc`;
                } else if (key == "track") {
                    arg0 = `--tn`;
                } else if (key == "genre") {
                    arg0 = `--tg`;
                } else if (key == "artwork") {
                    arg0 = `--ti`;
                } else if (key == "genre-list") {
                    arg0 = `--genre-list`;
                } else if (key == "pad-id3v2-size") {
                    arg0 = `--pad-id3v2-size`;
                } else {
                    throw new Error(
                        `lame: Invalid option: 'meta' unknown property '${key}'`,
                    );
                }

                const arg1 = `${value}`;

                this.args.push(arg0);
                this.args.push(arg1);
            } else if (
                key == "add-id3v2" ||
                key == "id3v1-only" ||
                key == "id3v2-only" ||
                key == "id3v2-latin1" ||
                key == "id3v2-utf16" ||
                key == "space-id3v1" ||
                key == "pad-id3v2" ||
                key == "ignore-tag-errors"
            ) {
                this.args.push(`--${key}`);
            } else {
                throw new Error(
                    `lame: Invalid option: 'meta' unknown property '${key}'`,
                );
            }
        }

        return undefined;
    }
}

export { LameOptions };
