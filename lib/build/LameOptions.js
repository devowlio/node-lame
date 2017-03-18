"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * All options of node-lame; build argument array for binary
 *
 * @class LameOptions
 */
var LameOptions = (function () {
    /**
     * Validate all options and build argument array for binary
     * @param {Object} options
     */
    function LameOptions(options) {
        this.args = [];
        // Output is required
        if (options.output == undefined) {
            throw new Error("LAME: Invalid option: 'output' is required");
        }
        // Save options as arguments
        for (var key in options) {
            var value = options[key];
            var arg = void 0;
            switch (key) {
                case "output":
                    arg = this.output(value);
                    break;
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
            if (arg != undefined) {
                for (var i in arg) {
                    this.args.push(arg[i]);
                }
            }
        }
    }
    /**
     * Get all arguments for binary
     */
    LameOptions.prototype.getArguments = function () {
        return this.args;
    };
    LameOptions.prototype.output = function (value) {
        return undefined; // Handle in Lame class, because of fixed possition (2nd parameter)
    };
    LameOptions.prototype.raw = function (value) {
        if (value == true) {
            return ["-r"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.swapBytes = function (value) {
        if (value == true) {
            return ["-x"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.sfreq = function (value) {
        if (value == 8 || value == 11.025 || value == 12 || value == 16 || value == 22.05 || value == 24 || value == 32 || value == 44.1 || value == 48) {
            return ["-s", value];
        }
        else {
            throw new Error("LAME: Invalid option: 'sfreq' is not in range of 8, 11.025, 12, 16, 22.05, 24, 32, 44.1 or 48.");
        }
    };
    LameOptions.prototype.bitwidth = function (value) {
        if (value == 8 || value == 16 || value == 24 || value == 32) {
            return ["--bitwidth", value];
        }
        else {
            throw new Error("LAME: Invalid option: 'sfreq' is not in range of 8, 16, 24 or 32.");
        }
    };
    LameOptions.prototype.signed = function (value) {
        if (value == true) {
            return ["--signed"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.unsigned = function (value) {
        if (value == true) {
            return ["--unsigned"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.littleEndian = function (value) {
        if (value == true) {
            return ["--little-endian"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.bigEndian = function (value) {
        if (value == true) {
            return ["--big-endian"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.mp2Input = function (value) {
        if (value == true) {
            return ["--mp2input"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.mp3Input = function (value) {
        if (value == true) {
            return ["--mp3input"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.mode = function (value) {
        if (value == "s" || value == "j" || value == "f" || value == "d" || value == "m" || value == "l" || value == "r") {
            return ["-m", value];
        }
        else {
            throw new Error("LAME: Invalid option: 'mode' is not in range of 's', 'j', 'f', 'd', 'm', 'l' or 'r'.");
        }
    };
    LameOptions.prototype.toMono = function (value) {
        if (value == true) {
            return ["-a"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.channelDifferentBlockSize = function (value) {
        if (value == true) {
            return ["-d"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.freeformat = function (value) {
        if (value == "FreeAmp" || value == "in_mpg123" || value == "l3dec" || value == "LAME" || value == "MAD") {
            return ["--freeformat", value];
        }
        else {
            throw new Error("LAME: Invalid option: Invalid option: 'mode' is not in range of 'FreeAmp', 'in_mpg123', 'l3dec', 'LAME', 'MAD'.");
        }
    };
    LameOptions.prototype.disableInfoTag = function (value) {
        if (value == true) {
            return ["-t"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.comp = function (value) {
        return ["--comp", value];
    };
    LameOptions.prototype.scale = function (value) {
        return ["--scale", value];
    };
    LameOptions.prototype.scaleL = function (value) {
        return ["--scale-l", value];
    };
    LameOptions.prototype.scaleR = function (value) {
        return ["--scale-r", value];
    };
    LameOptions.prototype.replaygainFast = function (value) {
        if (value == true) {
            return ["--replaygain-fast"];
        }
        else {
            return undefined;
        }
        ;
    };
    LameOptions.prototype.replaygainAccurate = function (value) {
        if (value == true) {
            return ["--replaygain-accurate"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.noreplaygain = function (value) {
        if (value == true) {
            return ["--noreplaygain"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.clipDetect = function (value) {
        if (value == true) {
            return ["--clipdetect"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.preset = function (value) {
        if (value == "medium" || value == "standard" || value == "extreme" || value == "insane") {
            return ["--preset", value];
        }
        else {
            throw new Error("LAME: Invalid option: Invalid option: 'mode' is not in range of 'medium', 'standard', 'extreme' or 'insane'.");
        }
    };
    LameOptions.prototype.noasm = function (value) {
        if (value == "mmx" || value == "3dnow" || value == "sse") {
            return ["--noasm", value];
        }
        else {
            throw new Error("LAME: Invalid option: 'noasm' is not in range of 'mmx', '3dnow' or 'sse'.");
        }
    };
    LameOptions.prototype.quality = function (value) {
        if (value >= 0 && value <= 9) {
            return ["-q", value];
        }
        else {
            throw new Error("LAME: Invalid option: 'quality' is not in range of 0 to 9.");
        }
    };
    LameOptions.prototype.bitrate = function (value) {
        if (value == 8 || value == 16 || value == 24 || value == 32 || value == 40 || value == 48 || value == 56 || value == 64 || value == 80 || value == 96 || value == 112 || value == 128 || value == 144 || value == 160 || value == 192 || value == 224 || value == 256 || value == 320) {
            return ["-b", value];
        }
        else {
            throw new Error("LAME: Invalid option: Invalid option: 'bitrate' is not in range of 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 192, 224, 256 or 320.");
        }
    };
    LameOptions.prototype.forceBitrate = function (value) {
        if (value == true) {
            return ["-F"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.cbr = function (value) {
        if (value == true) {
            return ["--cbr"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.abr = function (value) {
        if (value >= 8 && value <= 310) {
            return ["--abr", value];
        }
        else {
            throw new Error("LAME: Invalid option: 'abr' is not in range of 8 to 310.");
        }
    };
    LameOptions.prototype.vbr = function (value) {
        if (value == true) {
            return ["-v"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.vbrQuality = function (value) {
        if (value >= 0 && value <= 9) {
            return ["-V", value];
        }
        else {
            throw new Error("LAME: Invalid option: 'vbrQuality' is not in range of 0 to 9.");
        }
    };
    LameOptions.prototype.ignoreNoiseInSfb21 = function (value) {
        if (value == true) {
            return ["-Y"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.emp = function (value) {
        if (value == "n" || value == 5 || value == "c") {
            return ["-e", value];
        }
        else {
            throw new Error("LAME: Invalid option: 'emp' is not in range of 'n', 5 or 'c'.");
        }
    };
    LameOptions.prototype.markAsCopyrighted = function (value) {
        if (value == true) {
            return ["-c"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.markAsCopy = function (value) {
        if (value == true) {
            return ["-o"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.crcErrorProtection = function (value) {
        if (value == true) {
            return ["-p"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.nores = function (value) {
        if (value == true) {
            return ["--nores"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.strictlyEnforceIso = function (value) {
        if (value == true) {
            return ["--strictly-enforce-ISO"];
        }
        else {
            return undefined;
        }
    };
    LameOptions.prototype.lowpass = function (value) {
        return ["--lowpass", value];
    };
    LameOptions.prototype.lowpassWidth = function (value) {
        return ["--lowpass-width", value];
    };
    LameOptions.prototype.highpass = function (value) {
        return ["--highpass", value];
    };
    LameOptions.prototype.highpassWidth = function (value) {
        return ["--highpass-width", value];
    };
    LameOptions.prototype.resample = function (value) {
        if (value == 8 || value == 11.025 || value == 12 || value == 16 || value == 22.05 || value == 24 || value == 32 || value == 44.1 || value == 48) {
            return ["--resample", value];
        }
        else {
            throw new Error("LAME: Invalid option: 'resample' is not in range of 8, 11.025, 12, 16, 22.05, 24, 32, 44.1 or 48.");
        }
    };
    LameOptions.prototype.meta = function (metaObj) {
        for (var key in metaObj) {
            var value = metaObj[key];
            if (key == "title" || key == "artist" || key == "album" || key == "year" || key == "comment" || key == "track" || key == "genre" || key == "genre-list" || key == "pad-id3v2-size") {
                var arg0 = void 0;
                if (key == "title") {
                    arg0 = "--tt";
                }
                else if (key == "artist") {
                    arg0 = "-ta";
                }
                else if (key == "album") {
                    arg0 = "--tl";
                }
                else if (key == "year") {
                    arg0 = "--ty";
                }
                else if (key == "comment") {
                    arg0 = "--tc";
                }
                else if (key == "track") {
                    arg0 = "--tn";
                }
                else if (key == "genre") {
                    arg0 = "--tg";
                }
                else if (key == "genre-list") {
                    arg0 = "--genre-list";
                }
                else if (key == "pad-id3v2-size") {
                    arg0 = "--pad-id3v2-size";
                }
                else {
                    throw new Error("LAME: Invalid option: 'meta' unknown property '" + key + "'");
                }
                var arg1 = "'" + value + "'";
                this.args.push(arg0);
                this.args.push(arg1);
            }
            else if (key == "add-id3v2" || key == "id3v1-only" || key == "id3v2-only" || key == "id3v2-latin1" || key == "id3v2-utf16" || key == "space-id3v1" || key == "pad-id3v2" || key == "ignore-tag-errors") {
                this.args.push("--" + key);
            }
            else {
                throw new Error("LAME: Invalid option: 'meta' unknown property '" + key + "'");
            }
        }
        return undefined;
    };
    return LameOptions;
}());
exports.LameOptions = LameOptions;
//# sourceMappingURL=LameOptions.js.map