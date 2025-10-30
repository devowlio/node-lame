export { Lame } from "./core/lame";
export { LameOptions } from "./core/lame-options";
export {
    LameCodecStream,
    createLameDecoderStream,
    createLameEncoderStream,
} from "./core/lame-stream";
export type { LameOptionsBag, LameProgressEmitter, LameStatus } from "./types";
export type { LameStreamOptions } from "./types";
export {
    resolveBundledLameBinary,
    resolveLameBinary,
} from "./internal/binary/resolve-binary";
