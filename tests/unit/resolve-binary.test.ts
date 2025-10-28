import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sharedTempDir = join(tmpdir(), "node-lame-test-resolver");
const vendorDir = join(process.cwd(), "vendor", "lame");

const platformArch = `${process.platform}-${process.arch}`;
const vendorBinaryPath = join(
    vendorDir,
    platformArch,
    process.platform === "win32" ? "lame.exe" : "lame",
);

const importResolver = async () => {
    vi.resetModules();
    return await import("../../src/internal/binary/resolve-binary");
};

describe("resolve-binary", () => {
    beforeEach(async () => {
        await rm(sharedTempDir, { recursive: true, force: true });
        await rm(vendorDir, { recursive: true, force: true });
        delete process.env.LAME_BINARY;
    });

    afterEach(async () => {
        await rm(sharedTempDir, { recursive: true, force: true });
        await rm(vendorDir, { recursive: true, force: true });
        delete process.env.LAME_BINARY;
    });

    it("prefers explicit binary from environment", async () => {
        await mkdir(sharedTempDir, { recursive: true });
        const manualBinary = join(sharedTempDir, "lame");
        await writeFile(manualBinary, "#!/bin/sh\n", { mode: 0o755 });
        process.env.LAME_BINARY = manualBinary;

        const { resolveBundledLameBinary, resolveLameBinary } =
            await importResolver();

        expect(resolveBundledLameBinary()).toBe(manualBinary);
        expect(resolveLameBinary()).toBe(manualBinary);
    });

    it("returns vendor binary when present", async () => {
        await mkdir(join(vendorDir, platformArch), { recursive: true });
        await writeFile(vendorBinaryPath, "#!/bin/sh\n", { mode: 0o755 });

        const { resolveBundledLameBinary } = await importResolver();
        expect(resolveBundledLameBinary()).toBe(vendorBinaryPath);
    });

    it("falls back to vendor when env binary is missing", async () => {
        process.env.LAME_BINARY = join(sharedTempDir, "missing");
        await mkdir(join(vendorDir, platformArch), { recursive: true });
        await writeFile(vendorBinaryPath, "#!/bin/sh\n", { mode: 0o755 });

        const { resolveBundledLameBinary } = await importResolver();
        expect(resolveBundledLameBinary()).toBe(vendorBinaryPath);
    });

    it("falls back to system binary when nothing else resolves", async () => {
        const { resolveBundledLameBinary, resolveLameBinary } =
            await importResolver();

        expect(resolveBundledLameBinary()).toBeNull();
        expect(resolveLameBinary()).toBe("lame");
    });
});
