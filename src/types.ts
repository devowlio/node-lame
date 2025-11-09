import type { EventEmitter } from "events";

/**
 * Runtime status information emitted by encoder/decoder progress updates.
 */
interface LameStatus {
    started: boolean;
    finished: boolean;
    progress: number;
    eta?: string;
}

/**
 * Structured option bag accepted by the encoder.
 */
interface LameOptionsBag {
    output: string | "buffer" | "stream";
    raw?: boolean;
    "swap-bytes"?: boolean;
    "swap-channel"?: boolean;
    gain?: number;
    sfreq?: SampleFrequency;
    bitwidth?: BitWidth;
    signed?: boolean;
    unsigned?: boolean;
    "little-endian"?: boolean;
    "big-endian"?: boolean;
    mp1Input?: boolean;
    mp2Input?: boolean;
    mp3Input?: boolean;
    mode?: ChannelMode;
    "to-mono"?: boolean;
    "channel-different-block-sizes"?: boolean;
    freeformat?: boolean;
    "disable-info-tag"?: boolean;
    comp?: number;
    scale?: number;
    "scale-l"?: number;
    "scale-r"?: number;
    "replaygain-fast"?: boolean;
    "replaygain-accurate"?: boolean;
    "no-replaygain"?: boolean;
    "clip-detect"?: boolean;
    preset?: PresetProfile;
    noasm?: NoAsm;
    quality?: QualityLevel;
    "quality-high"?: boolean;
    "fast-encoding"?: boolean;
    bitrate?: BitRate;
    "max-bitrate"?: BitRate;
    "force-bitrate"?: boolean;
    cbr?: boolean;
    abr?: number;
    vbr?: boolean;
    "vbr-quality"?: number;
    "vbr-old"?: boolean;
    "vbr-new"?: boolean;
    "ignore-noise-in-sfb21"?: boolean;
    emp?: Emphasis;
    "mark-as-copyrighted"?: boolean;
    "mark-as-copy"?: boolean;
    "crc-error-protection"?: boolean;
    nores?: boolean;
    "strictly-enforce-ISO"?: boolean;
    lowpass?: number;
    "lowpass-width"?: number;
    highpass?: number;
    "highpass-width"?: number;
    resample?: SampleFrequency;
    "decode-mp3delay"?: number;
    "nogap"?: string[];
    "nogapout"?: string;
    "nogaptags"?: boolean;
    "out-dir"?: string;
    priority?: PriorityLevel;
    disptime?: number | false;
    silent?: boolean;
    quiet?: boolean;
    verbose?: boolean;
    help?: boolean | HelpTopic;
    usage?: boolean | HelpTopic;
    longhelp?: boolean;
    version?: boolean;
    license?: boolean;
    "no-histogram"?: boolean;
    meta?: MetaOptions;
}

type LameStreamMode = "encode" | "decode";

type LameStreamOptions = Omit<LameOptionsBag, "output"> & {
    output?: "stream";
    mode: LameStreamMode;
};

type SampleFrequency = 8 | 11.025 | 12 | 16 | 22.05 | 24 | 32 | 44.1 | 48;

type BitWidth = 8 | 16 | 24 | 32;

type ChannelMode = "s" | "j" | "f" | "d" | "m" | "l" | "r" | "a";

type PriorityLevel = 0 | 1 | 2 | 3 | 4;

type HelpTopic = "id3" | "dev";

type PresetProfile = string | number;

type NoAsm = "mmx" | "3dnow" | "sse";

type QualityLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

type BitRate =
    | 8
    | 16
    | 24
    | 32
    | 40
    | 48
    | 56
    | 64
    | 80
    | 96
    | 112
    | 128
    | 144
    | 160
    | 192
    | 224
    | 256
    | 320;

type Emphasis = "n" | 5 | "c";

type CustomFrameRecord =
    | Record<string, string | number | boolean>
    | Array<
          | string
          | [string, string | number | boolean]
          | { id: string; value: string | number | boolean }
      >;

interface MetaOptions {
    title?: string;
    artist?: string;
    album?: string;
    year?: string;
    comment?: string;
    track?: string;
    genre?: string;
    "add-id3v2"?: boolean;
    "id3v1-only"?: boolean;
    "id3v2-only"?: boolean;
    "id3v2-latin1"?: boolean;
    "id3v2-utf16"?: boolean;
    "space-id3v1"?: boolean;
    "pad-id3v2"?: boolean;
    "pad-id3v2-size"?: number;
    "genre-list"?: string;
    "ignore-tag-errors"?: boolean;
    custom?: CustomFrameRecord;
}

interface LameProgressEmitter extends EventEmitter {
    on(event: "progress", listener: (status: [number, string?]) => void): this;
    on(event: "finish", listener: () => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    once(
        event: "progress",
        listener: (status: [number, string?]) => void,
    ): this;
    once(event: "finish", listener: () => void): this;
    once(event: "error", listener: (error: Error) => void): this;
}

export type {
    BitRate,
    BitWidth,
    ChannelMode,
    Emphasis,
    LameOptionsBag,
    LameProgressEmitter,
    LameStatus,
    MetaOptions,
    NoAsm,
    PresetProfile,
    PriorityLevel,
    QualityLevel,
    SampleFrequency,
    HelpTopic,
    CustomFrameRecord,
    LameStreamOptions,
    LameStreamMode,
};
