import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as tar from "tar";

const sourceDir = process.argv[2] ?? "artifacts";
const vendorDir = process.argv[3] ?? "vendor/lame";

/**
 * Ensures that the source directory with the downloaded artifacts is present.
 */
function assertSourceDirectoryExists(directory) {
    if (!existsSync(directory)) {
        throw new Error(`Source directory '${directory}' does not exist`);
    }
}

/**
 * Detects whether a filename looks like a packaged lame artifact.
 */
function isTarballArtifact(entry) {
    return entry.endsWith(".tar.gz");
}

/**
 * Parses the platform/architecture information from the artifact filename.
 */
function parseArtifactCoordinates(entry) {
    const match = entry.match(/^lame-([\w]+)-([\w]+)\.tar\.gz$/);
    if (!match) {
        return null;
    }

    return { platform: match[1], arch: match[2] };
}

/**
 * Extracts a single artifact tarball into the vendor directory structure.
 */
async function extractArtifact(entry) {
    const coordinates = parseArtifactCoordinates(entry);
    if (!coordinates) {
        console.warn(`[node-lame] Skipping unexpected artifact '${entry}'`);
        return;
    }

    const destination = join(
        vendorDir,
        `${coordinates.platform}-${coordinates.arch}`,
    );
    mkdirSync(destination, { recursive: true });

    const tarball = join(sourceDir, entry);
    await tar.extract({ file: tarball, cwd: destination });
    console.log(`Extracted ${tarball} -> ${destination}`);
}

/**
 * Unpacks all artifacts from the source directory into vendor/lame.
 */
async function unpackArtifacts() {
    assertSourceDirectoryExists(sourceDir);
    mkdirSync(vendorDir, { recursive: true });

    for (const entry of readdirSync(sourceDir)) {
        if (!isTarballArtifact(entry)) {
            continue;
        }

        await extractArtifact(entry);
    }
}

unpackArtifacts().catch((error) => {
    console.error(`[node-lame] Failed to unpack artifacts: ${error.message}`);
    process.exitCode = 1;
});
