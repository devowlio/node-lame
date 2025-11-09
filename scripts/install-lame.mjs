import {
    chmodSync,
    copyFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { request } from "node:https";
import { spawn } from "node:child_process";
import * as tar from "tar";
import extractZip from "extract-zip";

const PACKAGE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const PLATFORM = process.env.NODE_LAME_PLATFORM ?? process.platform;
const ARCH = process.env.NODE_LAME_ARCH ?? process.arch;
const LAME_VERSION = process.env.LAME_VERSION ?? "3.100";
const EXECUTABLE_SUFFIX = PLATFORM === "win32" ? ".exe" : "";
const INSTALL_BASE = join(
    PACKAGE_ROOT,
    "vendor",
    "lame",
    `${PLATFORM}-${ARCH}`,
);
const TARGET_BINARY = join(INSTALL_BASE, `lame${EXECUTABLE_SUFFIX}`);
const LIB_DIRECTORY = join(INSTALL_BASE, "lib");
const LIB_DIRECTORY_MARKER = join(LIB_DIRECTORY, ".installed");
const LIBSNDFILE_VERSION = "1.2.0-1+deb12u1";

const DOWNLOAD_SOURCES = {
    "linux-x64": [
        {
            type: "debian",
            url: `https://deb.debian.org/debian/pool/main/l/lame/lame_${LAME_VERSION}-6_amd64.deb`,
        },
        {
            type: "ghcr",
            version: LAME_VERSION,
            os: "linux",
            arch: "amd64",
        },
    ],
    "linux-arm64": [
        {
            type: "debian",
            url: `https://deb.debian.org/debian/pool/main/l/lame/lame_${LAME_VERSION}-6_arm64.deb`,
        },
        {
            type: "ghcr",
            version: LAME_VERSION,
            os: "linux",
            arch: "arm64",
        },
    ],
    "linux-arm": [
        {
            type: "debian",
            url: `https://deb.debian.org/debian/pool/main/l/lame/lame_${LAME_VERSION}-6_armhf.deb`,
        },
    ],
    "darwin-arm64": [
        {
            type: "ghcr",
            version: LAME_VERSION,
            os: "darwin",
            arch: "arm64",
        },
    ],
    "darwin-x64": [
        {
            type: "ghcr",
            version: LAME_VERSION,
            os: "darwin",
            arch: "amd64",
        },
    ],
    "win32-x64": [
        {
            type: "zip",
            url: `https://www.rarewares.org/files/mp3/lame${LAME_VERSION}.1-x64.zip`,
        },
    ],
    "win32-ia32": [
        {
            type: "zip",
            url: `https://www.rarewares.org/files/mp3/lame${LAME_VERSION}.1-win32.zip`,
        },
    ],
    "win32-arm64": [
        {
            type: "zip",
            url: `https://www.rarewares.org/files/mp3/LAME-${LAME_VERSION}-Win-ARM64.zip`,
        },
    ],
};

const LINUX_SHARED_LIBRARY_PACKAGES = {
    "linux-x64": [
        {
            name: "libmp3lame0",
            url: `https://deb.debian.org/debian/pool/main/l/lame/libmp3lame0_${LAME_VERSION}-6_amd64.deb`,
            libraryRoot: "usr/lib/x86_64-linux-gnu",
        },
        {
            name: "libsndfile1",
            url: `https://deb.debian.org/debian/pool/main/libs/libsndfile/libsndfile1_${LIBSNDFILE_VERSION}_amd64.deb`,
            libraryRoot: "usr/lib/x86_64-linux-gnu",
        },
    ],
    "linux-arm64": [
        {
            name: "libmp3lame0",
            url: `https://deb.debian.org/debian/pool/main/l/lame/libmp3lame0_${LAME_VERSION}-6_arm64.deb`,
            libraryRoot: "usr/lib/aarch64-linux-gnu",
        },
        {
            name: "libsndfile1",
            url: `https://deb.debian.org/debian/pool/main/libs/libsndfile/libsndfile1_${LIBSNDFILE_VERSION}_arm64.deb`,
            libraryRoot: "usr/lib/aarch64-linux-gnu",
        },
    ],
    "linux-arm": [
        {
            name: "libmp3lame0",
            url: `https://deb.debian.org/debian/pool/main/l/lame/libmp3lame0_${LAME_VERSION}-6_armhf.deb`,
            libraryRoot: "usr/lib/arm-linux-gnueabihf",
        },
        {
            name: "libsndfile1",
            url: `https://deb.debian.org/debian/pool/main/libs/libsndfile/libsndfile1_${LIBSNDFILE_VERSION}_armhf.deb`,
            libraryRoot: "usr/lib/arm-linux-gnueabihf",
        },
    ],
};

/**
 * Logs installer progress messages with a consistent prefix.
 */
function logInstallerMessage(message) {
    console.log(`[node-lame] ${message}`);
}

/**
 * Downloads a remote resource and writes it to the given destination path.
 * Supports HTTP redirects and propagates any network or filesystem failures.
 */
async function downloadFileTo(url, destination, headers = {}) {
    await new Promise((resolve, reject) => {
        const req = request(url, { headers }, (res) => {
            if (
                res.statusCode &&
                res.statusCode >= 300 &&
                res.statusCode < 400 &&
                res.headers.location
            ) {
                downloadFileTo(res.headers.location, destination, headers)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            if (!res.statusCode || res.statusCode >= 400) {
                reject(
                    new Error(
                        `Failed to download ${url} (status ${
                            res.statusCode ?? "unknown"
                        })`,
                    ),
                );
                return;
            }

            const fileStream = createWriteStream(destination);
            pipeline(res, fileStream).then(resolve).catch(reject);
        });

        req.on("error", reject);
        req.end();
    });
}

/**
 * Executes a child process and resolves once it exits successfully.
 */
async function runCommandAndWait(command, args, options = {}) {
    await new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: "inherit",
            ...options,
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(
                    new Error(
                        `${command} ${args.join(" ")} exited with code ${code}`,
                    ),
                );
            }
        });

        child.on("error", reject);
    });
}

/**
 * Recursively collects all files within the provided directory tree.
 */
function collectFilesRecursively(root) {
    const queue = [root];
    const files = [];

    while (queue.length > 0) {
        const current = queue.pop();
        const stats = statSync(current, { throwIfNoEntry: false });

        if (!stats) continue;

        if (stats.isDirectory()) {
            for (const entry of readdirSync(current)) {
                queue.push(join(current, entry));
            }
        } else {
            files.push(current);
        }
    }

    return files;
}

/**
 * Extracts a ZIP archive and expands any nested ZIP files it contains.
 */
async function extractZipRecursively(zipPath, outDir) {
    await extractZip(zipPath, { dir: outDir });

    const entries = collectFilesRecursively(outDir).filter((file) =>
        file.endsWith(".zip"),
    );
    for (const entry of entries) {
        const nestedTarget = join(outDir, basename(entry, ".zip"));
        mkdirSync(nestedTarget, { recursive: true });
        await extractZip(entry, { dir: nestedTarget });
    }
}

/**
 * Downloads a ZIP bundle (typically from RareWares) and installs the contained binary.
 */
async function downloadAndInstallZipBinary(source) {
    const tmpDir = mkdtempSync(join(tmpdir(), "node-lame-zip-"));
    const archivePath = join(tmpDir, basename(new URL(source.url).pathname));

    await downloadFileTo(source.url, archivePath);

    const extractDir = join(tmpDir, "contents");
    mkdirSync(extractDir, { recursive: true });
    await extractZipRecursively(archivePath, extractDir);

    const targetName = PLATFORM === "win32" ? "lame.exe" : "lame";
    const candidates = collectFilesRecursively(extractDir).filter((path) =>
        path.toLowerCase().endsWith(targetName),
    );

    if (candidates.length === 0) {
        throw new Error(
            `Unable to locate ${targetName} inside downloaded archive`,
        );
    }

    writeBinaryToVendorDirectory(candidates[0]);
}

/**
 * Downloads and unpacks the Debian package for the host architecture.
 */
async function downloadAndInstallDebianBinary(source) {
    const tmpDir = mkdtempSync(join(tmpdir(), "node-lame-deb-"));
    const archivePath = join(tmpDir, basename(new URL(source.url).pathname));

    await downloadFileTo(source.url, archivePath);

    const extractDir = join(tmpDir, "extract");
    mkdirSync(extractDir, { recursive: true });

    await runCommandAndWait("ar", ["x", archivePath, "data.tar.xz"], {
        cwd: extractDir,
    });
    await runCommandAndWait("tar", ["-xf", "data.tar.xz", "./usr/bin/lame"], {
        cwd: extractDir,
    });

    const binaryPath = join(extractDir, "usr", "bin", "lame");
    writeBinaryToVendorDirectory(binaryPath);
}

/**
 * Downloads platform-specific Homebrew bottles from GHCR and installs the extracted binary.
 */
async function downloadAndInstallGhcrBinary(source) {
    const tmpDir = mkdtempSync(join(tmpdir(), "node-lame-ghcr-"));
    const token = await fetchJsonFromUrl(
        "https://ghcr.io/token?service=ghcr.io&scope=repository:homebrew/core/lame:pull",
    ).then((json) => json.token);

    const manifestList = await fetchJsonFromUrl(
        `https://ghcr.io/v2/homebrew/core/lame/manifests/${source.version}`,
        {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.oci.image.index.v1+json",
        },
    );

    const target = manifestList.manifests.find(
        (item) =>
            item.platform &&
            item.platform.os === source.os &&
            item.platform.architecture === source.arch,
    );

    if (!target) {
        throw new Error(
            `No GHCR manifest found for ${source.os}/${source.arch}`,
        );
    }

    const manifest = await fetchJsonFromUrl(
        `https://ghcr.io/v2/homebrew/core/lame/manifests/${target.digest}`,
        {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.oci.image.manifest.v1+json",
        },
    );

    const layer = manifest.layers.find((layer) =>
        layer.mediaType.includes("tar"),
    );

    if (!layer) {
        throw new Error("Unable to locate tar layer in GHCR manifest");
    }

    const layerPath = join(tmpDir, "layer.tar.gz");
    await downloadFileTo(
        `https://ghcr.io/v2/homebrew/core/lame/blobs/${layer.digest}`,
        layerPath,
        {
            Authorization: `Bearer ${token}`,
            Accept: "application/octet-stream",
        },
    );

    const extractDir = join(tmpDir, "contents");
    mkdirSync(extractDir, { recursive: true });
    await tar.x({
        file: layerPath,
        cwd: extractDir,
    });

    const candidates = collectFilesRecursively(extractDir).filter((path) =>
        path.endsWith("/bin/lame"),
    );

    if (candidates.length === 0) {
        throw new Error("Unable to locate lame binary within GHCR layer");
    }

    writeBinaryToVendorDirectory(candidates[0]);
}

/**
 * Fetches JSON from the provided URL while following redirects.
 */
async function fetchJsonFromUrl(url, headers = {}) {
    const buffer = await new Promise((resolve, reject) => {
        const req = request(url, { headers }, (res) => {
            if (
                res.statusCode &&
                res.statusCode >= 300 &&
                res.statusCode < 400 &&
                res.headers.location
            ) {
                fetchJsonFromUrl(res.headers.location, headers)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            if (!res.statusCode || res.statusCode >= 400) {
                reject(
                    new Error(
                        `Failed to fetch JSON from ${url} (status ${
                            res.statusCode ?? "unknown"
                        })`,
                    ),
                );
                return;
            }

            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => resolve(Buffer.concat(chunks)));
        });

        req.on("error", reject);
        req.end();
    });

    return JSON.parse(buffer.toString("utf-8"));
}

/**
 * Copies the resolved binary into the vendor directory and ensures executable permissions.
 */
function writeBinaryToVendorDirectory(fromPath) {
    mkdirSync(INSTALL_BASE, { recursive: true });
    copyFileSync(fromPath, TARGET_BINARY);
    chmodSync(TARGET_BINARY, 0o755);
    logInstallerMessage(`Installed LAME binary to ${TARGET_BINARY}`);
}

function copyLibrariesIntoTarget(sourceDir) {
    const entries = readdirSync(sourceDir);
    for (const entry of entries) {
        const fromPath = join(sourceDir, entry);
        const toPath = join(LIB_DIRECTORY, entry);
        cpSync(fromPath, toPath, {
            recursive: true,
            force: true,
            errorOnExist: false,
        });
    }
}

async function downloadAndInstallSharedLibraryPackage(dependency) {
    const tmpDir = mkdtempSync(join(tmpdir(), "node-lame-lib-"));
    const archivePath = join(tmpDir, basename(new URL(dependency.url).pathname));

    await downloadFileTo(dependency.url, archivePath);

    const extractDir = join(tmpDir, "extract");
    mkdirSync(extractDir, { recursive: true });

    await runCommandAndWait("ar", ["x", archivePath, "data.tar.xz"], {
        cwd: extractDir,
    });
    await runCommandAndWait("tar", ["-xf", "data.tar.xz"], {
        cwd: extractDir,
    });

    const sourceDir = join(extractDir, dependency.libraryRoot);
    if (!existsSync(sourceDir)) {
        throw new Error(
            `Unable to locate ${dependency.libraryRoot} in ${dependency.name} package`,
        );
    }

    copyLibrariesIntoTarget(sourceDir);
    logInstallerMessage(
        `Installed shared libraries for ${dependency.name} from ${dependency.url}`,
    );
}

async function installLinuxSharedLibraries() {
    const platformKey = `${PLATFORM}-${ARCH}`;
    const dependencies = LINUX_SHARED_LIBRARY_PACKAGES[platformKey];

    if (!dependencies || dependencies.length === 0) {
        logInstallerMessage(
            `No shared library dependencies configured for ${platformKey}`,
        );
        return;
    }

    if (existsSync(LIB_DIRECTORY_MARKER) && existsSync(LIB_DIRECTORY)) {
        logInstallerMessage(
            `Bundled shared libraries already present at ${LIB_DIRECTORY}`,
        );
        return;
    }

    rmSync(LIB_DIRECTORY, { recursive: true, force: true });
    mkdirSync(LIB_DIRECTORY, { recursive: true });

    for (const dependency of dependencies) {
        await downloadAndInstallSharedLibraryPackage(dependency);
    }

    writeFileSync(LIB_DIRECTORY_MARKER, String(Date.now()), "utf-8");
    logInstallerMessage(
        `Shared library installation complete at ${LIB_DIRECTORY}`,
    );
}

async function installPlatformSpecificDependencies() {
    if (PLATFORM === "linux") {
        try {
            await installLinuxSharedLibraries();
        } catch (error) {
            logInstallerMessage(
                `Failed to install Linux shared libraries: ${error.message}`,
            );
            throw error;
        }
    }
}

/**
 * Ensures a suitable LAME binary exists in the vendor directory, downloading it if absent.
 */
async function ensureBundledBinaryAvailable() {
    if (existsSync(TARGET_BINARY) && process.env.LAME_FORCE_DOWNLOAD !== "1") {
        logInstallerMessage(
            `Bundled LAME binary already present at ${TARGET_BINARY}`,
        );
        await installPlatformSpecificDependencies();
        return;
    }

    if (process.env.LAME_SKIP_DOWNLOAD === "1") {
        logInstallerMessage(
            "Skipping LAME binary download because LAME_SKIP_DOWNLOAD=1",
        );
        return;
    }

    const manualBinary = process.env.LAME_BINARY;
    if (manualBinary) {
        if (existsSync(manualBinary)) {
            logInstallerMessage(
                `Using manual LAME binary from ${manualBinary}`,
            );
            writeBinaryToVendorDirectory(manualBinary);
            return;
        }

        logInstallerMessage(
            `LAME_BINARY is set to '${manualBinary}' but the file does not exist`,
        );
    }

    const platformKey = `${PLATFORM}-${ARCH}`;
    const candidates = DOWNLOAD_SOURCES[platformKey];

    if (!candidates || candidates.length === 0) {
        logInstallerMessage(
            `No packaged LAME binary known for ${platformKey}. Falling back to system 'lame'.`,
        );
        return;
    }

    for (const source of candidates) {
        logInstallerMessage(
            `Attempting LAME download (${source.type}) for ${platformKey}`,
        );

        try {
            if (source.type === "zip") {
                await downloadAndInstallZipBinary(source);
                await installPlatformSpecificDependencies();
                return;
            }

            if (source.type === "debian") {
                if (PLATFORM !== "linux") {
                    logInstallerMessage(
                        "Skipping Debian package on non-Linux host",
                    );
                    continue;
                }

                await downloadAndInstallDebianBinary(source);
                await installPlatformSpecificDependencies();
                return;
            }

            if (source.type === "ghcr") {
                await downloadAndInstallGhcrBinary(source);
                await installPlatformSpecificDependencies();
                return;
            }

            logInstallerMessage(`Unsupported download type: ${source.type}`);
        } catch (error) {
            logInstallerMessage(
                `Download attempt (${source.type}) failed: ${error.message}`,
            );
        }
    }

    logInstallerMessage(
        `All download attempts for ${platformKey} failed. Falling back to system 'lame'.`,
    );
}

ensureBundledBinaryAvailable().catch((error) => {
    logInstallerMessage(
        `Unexpected error while installing LAME binary: ${error.message}`,
    );
});
