#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { platform } from "node:os";
import { delimiter } from "node:path";

const {
    resolveLameBinary,
    resolveBundledLibraryDirectory,
} = await import(new URL("../dist/index.cjs", import.meta.url));

function logSection(title) {
    console.log(`[lame-diagnostics] ${title}`);
}

const resolveLibraryDir = () => {
    if (typeof resolveBundledLibraryDirectory === "function") {
        return resolveBundledLibraryDirectory();
    }

    return null;
};

const libraryDir = resolveLibraryDir();
const libraryEnvVar =
    platform() === "linux"
        ? "LD_LIBRARY_PATH"
        : platform() === "darwin"
            ? "DYLD_LIBRARY_PATH"
            : platform() === "win32"
                ? "PATH"
                : null;

const withLibraryEnv = () => {
    const env = { ...process.env };
    if (libraryDir && libraryEnvVar) {
        env[libraryEnvVar] = env[libraryEnvVar]
            ? `${libraryDir}${delimiter}${env[libraryEnvVar]}`
            : libraryDir;
    }

    return env;
};

const runCommand = (cmd, args) => {
    const result = spawnSync(cmd, args, {
        encoding: "utf-8",
        env: withLibraryEnv(),
    });

    logSection(
        `${cmd} ${args.join(" ")} exited ${result.status} (signal: ${result.signal ?? "none"})`,
    );

    if (result.stdout) {
        console.log(result.stdout.trim());
    }

    if (result.stderr) {
        console.error(result.stderr.trim());
    }
};

const binaryPath = resolveLameBinary();
logSection(`Resolved binary: ${binaryPath}`);

try {
    const stats = statSync(binaryPath);
    logSection(
        `File stats -> size=${stats.size} mode=${stats.mode.toString(8)} mtime=${stats.mtime.toISOString()}`,
    );
} catch (error) {
    logSection(`stat() failed: ${error instanceof Error ? error.message : error}`);
}

if (libraryDir && libraryEnvVar) {
    logSection(
        `Using ${libraryEnvVar}=${libraryDir} when running diagnostics`,
    );
}

runCommand(binaryPath, ["--version"]);

if (platform() === "linux") {
    runCommand("ldd", [binaryPath]);
}

logSection(
    `Bundled library directory: ${libraryDir ?? "not found (not expected on this platform?)"}`,
);
if (libraryDir && existsSync(libraryDir)) {
    const entries = readdirSync(libraryDir);
    if (entries.length === 0) {
        logSection("Bundled library directory is empty");
    } else {
        logSection(
            `Bundled libraries:\n${entries.map((entry) => ` - ${entry}`).join("\n")}`,
        );
    }
}
