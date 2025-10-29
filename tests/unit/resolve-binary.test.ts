import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve as resolvePath } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
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

    it("derives module URLs from meta information when present", async () => {
        const {
            deriveModuleUrl,
            resolvePackageRoot,
            getPlatformExecutableSuffix,
        } = await importResolver();

        expect(deriveModuleUrl({ url: "file:///tmp/module.js" }, undefined)).toBe(
            "file:///tmp/module.js",
        );
        const fallback = deriveModuleUrl(undefined, "/tmp/example.js");
        expect(fallback).toBe(pathToFileURL("/tmp/example.js").href);
        expect(getPlatformExecutableSuffix("win32")).toBe(".exe");
        expect(getPlatformExecutableSuffix("linux" as typeof process.platform)).toBe("");
        expect(deriveModuleUrl(undefined, undefined)).toBeUndefined();
        expect(deriveModuleUrl({ url: 123 } as unknown as { url?: string }, "/tmp/fallback.js")).toBe(
            pathToFileURL("/tmp/fallback.js").href,
        );

        const dirPath = join("/tmp", "pkg", "dist", "internal", "binary");
        const derivedFromDir = resolvePackageRoot(undefined, dirPath);
        expect(derivedFromDir).toBe(join("/tmp", "pkg"));
        const derivedFromUrl = resolvePackageRoot(
            pathToFileURL(join("/tmp", "pkg", "dist", "internal", "binary", "module.js")).href,
            undefined,
        );
        expect(resolvePath(derivedFromUrl)).toBe(resolvePath(join("/tmp", "pkg")));
        const preferDirOverUrl = resolvePackageRoot(
            pathToFileURL(join("/tmp", "pkg", "lib", "module.js")).href,
            dirPath,
        );
        expect(preferDirOverUrl).toBe(join("/tmp", "pkg"));
        const derivedFromCwd = resolvePackageRoot(undefined, undefined);
        expect(derivedFromCwd).toBe(process.cwd());
    });
});
