import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const skipChangelog = process.env.SKIP_CHANGELOG === "1";
const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
);
const semverModule = await import("semver");
const semver = semverModule.default ?? semverModule;
const targetVersion = "2.0.0";
const isBeforeTarget = semver.lt(packageJson.version, targetVersion);

const runCommand = (args) => {
    const result = spawnSync("pnpm", args, {
        stdio: "inherit",
        env: {
            ...process.env,
            HUSKY: "0",
        },
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
};

if (skipChangelog) {
    let releaseType = "patch";

    try {
        const module = await import("conventional-recommended-bump");
        const candidate =
            typeof module.default === "function"
                ? module.default
                : undefined;

        if (candidate) {
            const recommendation = await candidate({
                preset: "conventionalcommits",
            });
            releaseType = recommendation?.releaseType ?? "patch";
        } else {
            console.warn(
                "[release] conventional-recommended-bump did not expose a callable default export. Defaulting to patch bump.",
            );
        }
    } catch (error) {
        console.warn(
            `[release] Failed to determine recommended bump (${error.message}). Defaulting to patch.`,
        );
    }

    let nextVersion =
        semver.inc(packageJson.version, releaseType) ?? targetVersion;

    if (isBeforeTarget && semver.lt(nextVersion, targetVersion)) {
        console.log(
            `[release] Forcing version to ${targetVersion} to begin the 2.x line.`,
        );
        nextVersion = targetVersion;
    }

    console.log(
        `[release] Skipping changelog generation. Bumping version to ${nextVersion} (${releaseType}).`,
    );

    runCommand([
        "lerna",
        "version",
        nextVersion,
        "--yes",
        "--no-commit-hooks",
        "--conventional-commits",
        "--no-push",
    ]);
} else {
    console.log(
        "[release] Using Conventional Commits to generate the changelog.",
    );

    if (isBeforeTarget) {
        console.log(
            `[release] Forcing version to ${targetVersion} to begin the 2.x line.`,
        );
        runCommand([
            "lerna",
            "version",
            targetVersion,
            "--yes",
            "--no-commit-hooks",
            "--conventional-commits",
        ]);
    } else {
        runCommand([
            "lerna",
            "version",
            "--yes",
            "--no-commit-hooks",
        ]);
    }
}
