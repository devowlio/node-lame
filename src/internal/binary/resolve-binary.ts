import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

declare const __dirname: string | undefined;
declare const __filename: string | undefined;

type ImportMetaLike = { url?: string } | undefined;

function deriveModuleUrl(
    meta: ImportMetaLike,
    filename: string | undefined,
): string | undefined {
    if (meta && typeof meta.url === "string") {
        return meta.url;
    }

    if (typeof filename === "string") {
        return pathToFileURL(filename).href;
    }

    return undefined;
}

const moduleUrl = (() => {
    let meta: ImportMetaLike = undefined;

    try {
        meta = import.meta as ImportMetaLike;
    } catch {
        // ignore when import.meta is unavailable (CommonJS build)
    }

    const resolvedFilename =
        typeof __filename === "string" ? __filename : undefined;

    return deriveModuleUrl(meta, resolvedFilename);
})();

function findPackageRootFrom(startDir: string): string | null {
    let current = startDir;

    while (true) {
        const packageJsonPath = join(current, "package.json");
        if (existsSync(packageJsonPath)) {
            return current;
        }

        const parent = dirname(current);
        if (parent === current) {
            return null;
        }

        current = parent;
    }
}

function resolvePackageRoot(
    moduleHref: string | undefined,
    dirname: string | undefined,
): string {
    const normalizedDir =
        dirname ??
        (moduleHref != null
            ? fileURLToPath(new URL(".", moduleHref))
            : undefined);

    if (normalizedDir) {
        const detectedRoot = findPackageRootFrom(normalizedDir);
        if (detectedRoot) {
            return detectedRoot;
        }
    }

    if (dirname) {
        return join(dirname, "..", "..", "..");
    }

    if (moduleHref != null) {
        return fileURLToPath(new URL("../../..", moduleHref));
    }

    return process.cwd();
}

const PACKAGE_ROOT = resolvePackageRoot(
    moduleUrl,
    typeof __dirname === "string" ? __dirname : undefined,
);
const CUSTOM_BINARY_ENV = "LAME_BINARY";
const LIBRARY_DIRECTORY_NAME = "lib";

function getPlatformExecutableSuffix(platform: typeof process.platform): string {
    return platform === "win32" ? ".exe" : "";
}

const PLATFORM_EXECUTABLE_SUFFIX = getPlatformExecutableSuffix(
    process.platform,
);

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

function resolveBundledLibraryDirectory(): string | null {
    const candidate = join(
        PACKAGE_ROOT,
        "vendor",
        "lame",
        `${process.platform}-${process.arch}`,
        LIBRARY_DIRECTORY_NAME,
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

export {
    deriveModuleUrl,
    getPlatformExecutableSuffix,
    resolveBundledLameBinary,
    resolveBundledLibraryDirectory,
    resolveLameBinary,
    resolvePackageRoot,
};
