import type { LameOptionsBag, PriorityLevel } from "../types";

/**
 * Translates option objects into the argument list expected by the LAME CLI.
 */
class LameOptions {
    private readonly args: string[] = [];
    private useDefaultDisptime = true;
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
                case "swap-channel":
                    arg = this.swapChannel(value);
                    break;
                case "gain":
                    arg = this.gain(value);
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
                case "mp1Input":
                    arg = this.mp1Input(value);
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
                case "nogap":
                    arg = this.nogap(value);
                    break;
                case "nogapout":
                    arg = this.nogapout(value);
                    break;
                case "nogaptags":
                    arg = this.nogaptags(value);
                    break;
                case "out-dir":
                    arg = this.outDir(value);
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
                case "quality-high":
                    arg = this.qualityHigh(value);
                    break;
                case "fast-encoding":
                    arg = this.fastEncoding(value);
                    break;
                case "bitrate":
                    arg = this.bitrate(value);
                    break;
                case "max-bitrate":
                    arg = this.maxBitrate(value);
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
                case "vbr-old":
                    arg = this.vbrOld(value);
                    break;
                case "vbr-new":
                    arg = this.vbrNew(value);
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
                case "decode-mp3delay":
                    arg = this.decodeMp3Delay(value);
                    break;
                case "priority":
                    arg = this.priority(value);
                    break;
                case "disptime":
                    arg = this.disptime(value);
                    break;
                case "silent":
                    arg = this.silent(value);
                    break;
                case "quiet":
                    arg = this.quiet(value);
                    break;
                case "verbose":
                    arg = this.verbose(value);
                    break;
                case "help":
                    arg = this.help(value);
                    break;
                case "usage":
                    arg = this.usage(value);
                    break;
                case "longhelp":
                    arg = this.longHelp(value);
                    break;
                case "version":
                    arg = this.version(value);
                    break;
                case "license":
                    arg = this.license(value);
                    break;
                case "no-histogram":
                    arg = this.noHistogram(value);
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

    public shouldUseDefaultDisptime() {
        return this.useDefaultDisptime;
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

    private swapChannel(value: unknown) {
        if (value == true) {
            return [`--swap-channel`];
        }

        return undefined;
    }

    private gain(value: unknown) {
        if (value === undefined) {
            return undefined;
        }

        if (typeof value === "number" && value >= -20 && value <= 12) {
            return [`--gain`, String(value)];
        }

        throw new Error(
            "lame: Invalid option: 'gain' must be a number between -20 and 12.",
        );
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

    private mp1Input(value: unknown) {
        if (value == true) {
            return [`--mp1input`];
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
            value == "r" ||
            value == "a"
        ) {
            return [`-m`, String(value)];
        } else {
            throw new Error(
                "lame: Invalid option: 'mode' is not in range of 's', 'j', 'f', 'd', 'm', 'l', 'r' or 'a'.",
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
        if (value == null || value === false) {
            return undefined;
        }

        if (typeof value === "string") {
            if (
                value === "FreeAmp" ||
                value === "in_mpg123" ||
                value === "l3dec" ||
                value === "LAME" ||
                value === "MAD"
            ) {
                return [`--freeformat`];
            }

            throw new Error(
                "lame: Invalid option: 'freeformat' string value must be one of 'FreeAmp', 'in_mpg123', 'l3dec', 'LAME', 'MAD'.",
            );
        }

        if (value == true) {
            return [`--freeformat`];
        }

        throw new Error("lame: Invalid option: 'freeformat' must be boolean.");
    }

    private disableInfoTag(value: unknown) {
        if (value == true) {
            return [`-t`];
        } else {
            return undefined;
        }
    }

    private nogap(value: unknown) {
        if (value == null) {
            return undefined;
        }

        if (
            Array.isArray(value) &&
            value.length > 0 &&
            value.every((item) => typeof item === "string" && item.trim() !== "")
        ) {
            return [`--nogap`, ...value];
        }

        throw new Error(
            "lame: Invalid option: 'nogap' must be a non-empty array of file paths.",
        );
    }

    private nogapout(value: unknown) {
        if (value == null) {
            return undefined;
        }

        if (typeof value === "string" && value.trim() !== "") {
            return [`--nogapout`, value];
        }

        throw new Error(
            "lame: Invalid option: 'nogapout' must be a non-empty string path.",
        );
    }

    private nogaptags(value: unknown) {
        if (value === undefined || value === false) {
            return undefined;
        }

        if (value == true) {
            return [`--nogaptags`];
        }

        throw new Error("lame: Invalid option: 'nogaptags' must be boolean.");
    }

    private outDir(value: unknown) {
        if (value == null) {
            return undefined;
        }

        if (typeof value === "string" && value.trim() !== "") {
            return [`--out-dir`, value];
        }

        throw new Error(
            "lame: Invalid option: 'out-dir' must be a non-empty string path.",
        );
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
        if (value == null) {
            return undefined;
        }

        if (typeof value === "number" && value >= 8 && value <= 640) {
            return [`--preset`, String(value)];
        }

        if (typeof value !== "string") {
            return this.invalidPreset();
        }

        const trimmed = value.trim();
        if (trimmed === "") {
            throw new Error("lame: Invalid option: 'preset' cannot be empty.");
        }

        const tokens = trimmed.split(/\s+/);
        const [first, second] = tokens;

        const singleValuePresets = [
            "medium",
            "standard",
            "extreme",
            "insane",
            "phone",
            "phon+",
            "lw",
            "mw-eu",
            "mw-us",
            "voice",
            "fm",
            "radio",
            "hifi",
            "cd",
            "studio",
        ];

        if (tokens.length === 1) {
            if (singleValuePresets.includes(first) || /^[0-9]+$/.test(first)) {
                return [`--preset`, first];
            }

            return this.invalidPreset();
        }

        if (
            tokens.length === 2 &&
            first === "fast" &&
            (second === "medium" ||
                second === "standard" ||
                second === "extreme" ||
                /^[0-9]+$/.test(second))
        ) {
            return [`--preset`, "fast", second];
        }

        if (tokens.length === 2 && first === "cbr" && /^[0-9]+$/.test(second)) {
            return [`--preset`, "cbr", second];
        }

        return this.invalidPreset();
    }

    private invalidPreset(): never {
        throw new Error(
            "lame: Invalid option: 'preset' must be a supported preset keyword, numeric bitrate, or preset tuple like 'fast <value>' or 'cbr <bitrate>'.",
        );
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

    private qualityHigh(value: unknown) {
        if (value == true) {
            return [`-h`];
        }

        if (value === undefined || value === false) {
            /* c8 ignore next */
            return undefined;
        }

        throw new Error(
            "lame: Invalid option: 'quality-high' must be boolean.",
        );
    }

    private fastEncoding(value: unknown) {
        if (value == true) {
            return [`-f`];
        }

        if (value === undefined || value === false) {
            return undefined;
        }

        throw new Error(
            "lame: Invalid option: 'fast-encoding' must be boolean.",
        );
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

    private maxBitrate(value: unknown) {
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
            return [`-B`, String(value)];
        } else if (value === undefined) {
            return undefined;
        }

        throw new Error(
            "lame: Invalid option: 'max-bitrate' is not in range of 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256 or 320.",
        );
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

    private vbrOld(value: unknown) {
        if (value == true) {
            return [`--vbr-old`];
        }

        if (value === undefined || value === false) {
            return undefined;
        }

        throw new Error(
            "lame: Invalid option: 'vbr-old' must be boolean.",
        );
    }

    private vbrNew(value: unknown) {
        if (value == true) {
            return [`--vbr-new`];
        }

        if (value === undefined || value === false) {
            return undefined;
        }

        throw new Error(
            "lame: Invalid option: 'vbr-new' must be boolean.",
        );
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

    private decodeMp3Delay(value: unknown) {
        if (value == null) {
            return undefined;
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            return [`--decode-mp3delay`, String(value)];
        }

        throw new Error(
            "lame: Invalid option: 'decode-mp3delay' must be a finite number.",
        );
    }

    private priority(value: unknown) {
        if (value == null) {
            return undefined;
        }

        if (
            typeof value === "number" &&
            Number.isInteger(value) &&
            value >= 0 &&
            value <= 4
        ) {
            return [`--priority`, String(value as PriorityLevel)];
        }

        throw new Error(
            "lame: Invalid option: 'priority' must be an integer between 0 and 4.",
        );
    }

    private disptime(value: unknown) {
        if (value === false) {
            this.useDefaultDisptime = false;
            return undefined;
        }

        if (value == null) {
            return undefined;
        }

        if (typeof value === "number" && value > 0) {
            this.useDefaultDisptime = false;
            return [`--disptime`, String(value)];
        }

        throw new Error(
            "lame: Invalid option: 'disptime' must be a positive number of seconds or false to disable progress output.",
        );
    }

    private silent(value: unknown) {
        if (value === undefined || value === false) {
            return undefined;
        }

        if (value == true) {
            return [`--silent`];
        }

        throw new Error(
            "lame: Invalid option: 'silent' must be boolean.",
        );
    }

    private quiet(value: unknown) {
        if (value === undefined || value === false) {
            return undefined;
        }

        if (value == true) {
            return [`--quiet`];
        }

        throw new Error(
            "lame: Invalid option: 'quiet' must be boolean.",
        );
    }

    private verbose(value: unknown) {
        if (value === undefined || value === false) {
            return undefined;
        }

        if (value == true) {
            return [`--verbose`];
        }

        throw new Error(
            "lame: Invalid option: 'verbose' must be boolean.",
        );
    }

    private help(value: unknown) {
        return this.helpLike("--help", value);
    }

    private usage(value: unknown) {
        return this.helpLike("--usage", value);
    }

    private longHelp(value: unknown) {
        if (value === undefined || value === false) {
            return undefined;
        }

        if (value == true) {
            return [`--longhelp`];
        }

        throw new Error(
            "lame: Invalid option: 'longhelp' must be boolean.",
        );
    }

    private version(value: unknown) {
        if (value == true) {
            return [`--version`];
        }

        if (value === undefined || value === false) {
            return undefined;
        }

        throw new Error(
            "lame: Invalid option: 'version' must be boolean.",
        );
    }

    private license(value: unknown) {
        if (value == true) {
            return [`--license`];
        }

        if (value === undefined || value === false) {
            return undefined;
        }

        throw new Error(
            "lame: Invalid option: 'license' must be boolean.",
        );
    }

    private noHistogram(value: unknown) {
        if (value == true) {
            return [`--nohist`];
        }

        if (value === undefined || value === false) {
            return undefined;
        }

        throw new Error(
            "lame: Invalid option: 'no-histogram' must be boolean.",
        );
    }

    private helpLike(flag: string, value: unknown) {
        if (value == true) {
            return [flag];
        }

        if (
            typeof value === "string" &&
            (value === "id3" || value === "dev")
        ) {
            return [flag, value];
        }

        if (value === undefined || value === false) {
            return undefined;
        }

        throw new Error(
            `lame: Invalid option: '${flag.slice(2)}' must be boolean or one of 'id3', 'dev'.`,
        );
    }

    private meta(metaObj: unknown) {
        if (metaObj == null || typeof metaObj !== "object") {
            throw new Error("lame: Invalid option: 'meta' must be an object.");
        }

        const metaRecord = metaObj as Record<string, unknown>;

        const fieldMap: Record<string, string> = {
            title: "--tt",
            artist: "--ta",
            album: "--tl",
            year: "--ty",
            comment: "--tc",
            track: "--tn",
            genre: "--tg",
            artwork: "--ti",
            "genre-list": "--genre-list",
            "pad-id3v2-size": "--pad-id3v2-size",
        };

        for (const key of Object.keys(metaRecord)) {
            const value = metaRecord[key];

            if (key in fieldMap) {
                this.args.push(fieldMap[key]);
                this.args.push(`${value}`);
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
            } else if (key == "custom") {
                this.appendCustomFrames(value);
            } else {
                throw new Error(
                    `lame: Invalid option: 'meta' unknown property '${key}'`,
                );
            }
        }

        return undefined;
    }

    private appendCustomFrames(value: unknown) {
        if (value == null) {
            return;
        }

        const pushFrame = (id: string, frameValue: unknown) => {
            if (typeof id !== "string" || id.trim() === "") {
                throw new Error(
                    "lame: Invalid option: 'meta.custom' frame id must be a non-empty string.",
                );
            }

            this.args.push("--tv");
            this.args.push(`${id}=${String(frameValue)}`);
        };

        if (Array.isArray(value)) {
            for (const entry of value) {
                if (typeof entry === "string") {
                    const [id, ...rest] = entry.split("=");
                    if (!id || rest.length === 0) {
                        throw new Error(
                            "lame: Invalid option: 'meta.custom' array entries must be 'id=value'.",
                        );
                    }
                    pushFrame(id, rest.join("="));
                } else if (Array.isArray(entry) && entry.length === 2) {
                    pushFrame(
                        String(entry[0]),
                        entry[1],
                    );
                } else if (
                    typeof entry === "object" &&
                    entry != null &&
                    "id" in entry &&
                    "value" in entry
                ) {
                    const typedEntry = entry as { id: string; value: unknown };
                    pushFrame(typedEntry.id, typedEntry.value);
                } else {
                    throw new Error(
                        "lame: Invalid option: 'meta.custom' array entries must be strings, tuples, or objects with id/value.",
                    );
                }
            }
            return;
        }

        if (typeof value === "object") {
            const record = value as Record<string, unknown>;
            for (const [id, frameValue] of Object.entries(record)) {
                pushFrame(id, frameValue);
            }
            return;
        }

        throw new Error(
            "lame: Invalid option: 'meta.custom' must be an array or object.",
        );
    }
}

export { LameOptions };
