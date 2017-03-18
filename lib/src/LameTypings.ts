/**
 * Status data of lame instance
 * 
 * @interface LameStatus
 */
interface LameStatus {
    "started": boolean;
    "finished": boolean;
    "progress": number;
    "eta": string;
}

/**
 * Raw options interface and types for Typescript definitions
 */
namespace Options {
    export type sfreq = 8 | 11.025 | 12 | 16 | 22.05 | 24 | 32 | 44.1 | 48;
    export type bitwidth = 8 | 16 | 24 | 32;
    export type mode = "s" | "j" | "f" | "d" | "m" | "l" | "r";
    export type freeformat = "FreeAmp" | "in_mpg123" | "l3dec" | "LAME" | "MAD";
    export type preset = "medium" | "standard" | "extreme" | "insane";
    export type noasm = "mmx" | "3dnow" | "sse";
    export type quality = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    export type bitrate = 8 | 16 | 24 | 32 | 40 | 48 | 56 | 64 | 80 | 96 | 112 | 128 | 144 | 160 | 192 | 224 | 256 | 320;
    export type emp = "n" | 5 | "c";
    export type resample = 8 | 11.025 | 12 | 16 | 22.05 | 24 | 32 | 44.1 | 48;

    export interface meta {
        "title"?: string;
        "artist"?: string;
        "album"?: string;
        "year"?: string;
        "comment"?: string;
        "track"?: string;
        "genre"?: string;

        "add-id3v2"?: boolean;
        "id3v1-only"?: boolean;
        "id3v2-only"?: boolean;
        "id3v2-latin1"?: boolean;
        "id3v2-utf16"?: boolean;
        "space-id3v1"?: boolean;
        "pad-id3v2-size"?: number;
        "genre-list"?: string;
        "ignore-tag-errors"?: boolean;
    }
}

interface Options {
    "output": string | "buffer";
    "raw"?: boolean;
    "swap-bytes"?: boolean;
    "sfreq"?: Options.sfreq;
    "bitwidth"?: Options.bitwidth;
    "signed"?: boolean;
    "unsigned"?: boolean;
    "little-endian"?: boolean;
    "big-endian"?: boolean;
    "mp2Input"?: boolean;
    "mp3Input"?: boolean;
    "mode"?: Options.mode;
    "to-mono"?: boolean;
    "channel-different-block-sizes"?: boolean;
    "freeformat"?: Options.freeformat;
    "disable-info-tag"?: boolean;
    "comp"?: number;
    "scale"?: number;
    "scale-l"?: number;
    "scale-r"?: number;
    "replaygain-fast"?: boolean;
    "replaygain-accurate"?: boolean;
    "no-replaygain"?: boolean;
    "clip-detect"?: boolean;
    "preset"?: Options.preset;
    "noasm"?: Options.noasm;
    "quality"?: Options.quality;
    "bitrate"?: Options.bitrate;
    "force-bitrate"?: boolean;
    "cbr"?: boolean;
    "abr"?: number;
    "vbr"?: boolean;
    "vbr-quality"?: number;
    "ignore-noise-in-sfb21"?: boolean;
    "emp"?: Options.emp;
    "mark-as-copyrighted"?: boolean;
    "mark-as-copy"?: boolean;
    "crc-error-protection"?: boolean;
    "nores"?: boolean;
    "strictly-enforce-ISO"?: boolean;
    "lowpass"?: number;
    "lowpass-width"?: number;
    "highpass"?: number;
    "highpass-width"?: number;
    "resample"?: Options.resample;
    "meta"?: Options.meta;
}

export { LameStatus, Options };