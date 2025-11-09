import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const skipChangelog = process.env.SKIP_CHANGELOG === "1";
const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
);

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
    const [{ default: conventionalRecommendedBump }, semver] = await Promise.all(
        [
            import("conventional-recommended-bump"),
            import("semver"),
        ],
    );

    const releaseType = await new Promise((resolve, reject) => {
        conventionalRecommendedBump(
            { preset: "conventionalcommits" },
            (error, recommendation) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(recommendation.releaseType ?? "patch");
            },
        );
    });

    const nextVersion = semver.inc(
        packageJson.version,
        releaseType ?? "patch",
    );
    if (!nextVersion) {
        throw new Error("Unable to determine next version for release.");
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
        "--no-changelog",
        "--no-conventional-commits",
    ]);
} else {
    console.log(
        "[release] Using Conventional Commits to generate the changelog.",
    );

    runCommand([
        "lerna",
        "version",
        "--yes",
        "--no-commit-hooks",
    ]);
}
