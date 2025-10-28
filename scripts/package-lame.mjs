import { chmodSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as tar from "tar";

/**
 * Parses command line arguments provided to the packaging script.
 */
function parsePackagingArguments() {
    const args = process.argv.slice(2);
    const parsed = {};
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        const value = args[i + 1];
        if (!value) {
            throw new Error(`Missing value for argument ${key}`);
        }

        if (key === "--binary") {
            parsed.binary = value;
        } else if (key === "--platform") {
            parsed.platform = value;
        } else if (key === "--arch") {
            parsed.arch = value;
        } else if (key === "--out-dir") {
            parsed.outDir = value;
        } else {
            throw new Error(`Unknown argument ${key}`);
        }
    }

    if (!parsed.binary || !parsed.platform || !parsed.arch || !parsed.outDir) {
        throw new Error(
            "Usage: node scripts/package-lame.mjs --binary <path> --platform <platform> --arch <arch> --out-dir <dir>",
        );
    }

    return parsed;
}

/**
 * Packages the provided LAME binary into a tarball and emits a manifest alongside it.
 */
async function packageLameBinary() {
    const { binary, platform, arch, outDir } = parsePackagingArguments();
    const artifactDir = join(outDir, `${platform}-${arch}`);
    mkdirSync(artifactDir, { recursive: true });

    const fileName = platform === "win32" ? "lame.exe" : "lame";
    const targetPath = join(artifactDir, fileName);

    copyFileSync(binary, targetPath);
    chmodSync(targetPath, 0o755);

    const tarBallName = `lame-${platform}-${arch}.tar.gz`;
    const tarBallPath = join(outDir, tarBallName);

    await tar.create(
        {
            gzip: true,
            file: tarBallPath,
            cwd: artifactDir,
        },
        [fileName],
    );

    // Emit a manifest for postinstall script compatibility checks.
    const manifestPath = join(outDir, `${platform}-${arch}.json`);
    const manifest = {
        platform,
        arch,
        binary: fileName,
        sha256: null,
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log(`Packaged ${binary} into ${tarBallPath}`);
}

packageLameBinary().catch((error) => {
    console.error(`[node-lame] Failed to package binary: ${error.message}`);
    process.exitCode = 1;
});
