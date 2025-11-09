import { spawnSync } from "node:child_process";

const args = [
    "lerna",
    "version",
    "--yes",
    "--no-commit-hooks",
];

console.log("[release] Using Conventional Commits to generate the changelog.");

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
