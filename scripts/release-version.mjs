import { spawnSync } from "node:child_process";

const skipChangelog = process.env.SKIP_CHANGELOG === "1";
const args = [
    "lerna",
    "version",
    "--yes",
    "--no-commit-hooks",
];

if (skipChangelog) {
    args.push("--no-changelog");
    console.log(
        "[release] Skipping automatic changelog generation for this run.",
    );
} else {
    console.log(
        "[release] Using Conventional Commits to generate the changelog.",
    );
}

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
