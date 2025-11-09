export { Lame } from "./core/lame";
export { LameOptions } from "./core/lame-options";
export { LameStream } from "./core/lame-stream";
export type { LameOptionsBag, LameProgressEmitter, LameStatus } from "./types";
export type { LameStreamOptions } from "./types";
export {
    resolveBundledLameBinary,
    resolveBundledLibraryDirectory,
    resolveLameBinary,
} from "./internal/binary/resolve-binary";
