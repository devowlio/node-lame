import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

declare const __dirname: string | undefined;
declare const __filename: string | undefined;

const moduleUrl = (() => {
    try {
        const meta = import.meta as { url?: string };
        if (meta && typeof meta.url === "string") {
            return meta.url;
        }
    } catch {
        // Swallow ReferenceError when import.meta is unavailable (CommonJS build).
    }

    if (typeof __filename === "string") {
        return pathToFileURL(__filename).href;
    }

    return undefined;
})();

const PACKAGE_ROOT =
    typeof __dirname === "string"
        ? join(__dirname, "..", "..", "..")
        : moduleUrl != null
          ? fileURLToPath(new URL("../../..", moduleUrl))
          : process.cwd();
const CUSTOM_BINARY_ENV = "LAME_BINARY";

const PLATFORM_EXECUTABLE_SUFFIX = process.platform === "win32" ? ".exe" : "";

/**
 * Attempt to resolve the absolute path to a bundled LAME binary.
 * Returns null when no bundled binary could be found.
 */
function resolveBundledLameBinary(): string | null {
    const explicitBinary = process.env[CUSTOM_BINARY_ENV];
    if (explicitBinary && existsSync(explicitBinary)) {
        return explicitBinary;
    }

    const candidate = join(
        PACKAGE_ROOT,
        "vendor",
        "lame",
        `${process.platform}-${process.arch}`,
        `lame${PLATFORM_EXECUTABLE_SUFFIX}`,
    );

    if (existsSync(candidate)) {
        return candidate;
    }

    return null;
}

/**
 * Resolve the binary to use. Preference order:
 * 1. `LAME_BINARY` environment variable.
 * 2. Bundled prebuilt binary located in `vendor/lame/<platform>-<arch>/`.
 * 3. Fallback to the `lame` executable on PATH.
 */
function resolveLameBinary(): string {
    const resolved = resolveBundledLameBinary();
    return resolved ?? "lame";
}

export { resolveBundledLameBinary, resolveLameBinary };
