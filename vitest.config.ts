import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        coverage: {
            provider: "istanbul",
            reportsDirectory: "coverage",
            reporter: ["text", "html"],
        },
    },
});
