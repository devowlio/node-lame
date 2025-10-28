import { chmod } from "node:fs/promises";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { Lame } from "../../src/core/lame";

const shouldRun = process.platform !== "win32";

(shouldRun ? describe : describe.skip)("Lame integration", () => {
    it("encodes a small buffer using a fake LAME binary", async () => {
        const workdir = await mkdtemp(join(tmpdir(), "node-lame-test-"));
        const inputPath = join(workdir, "input.raw");
        const outputPath = join(workdir, "output.mp3");
        const fakeBinaryPath = join(workdir, "fake-lame.mjs");

        const inputBuffer = randomBytes(16);
        await writeFile(inputPath, Uint8Array.from(inputBuffer));

        const fakeBinary = `#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
const [, , input, output] = process.argv;
const payload = readFileSync(input);
writeFileSync(output, payload);
console.error('(  0%)| 00:01 ');
console.error('Writing LAME Tag...done');
process.exit(0);
`;
        await writeFile(fakeBinaryPath, fakeBinary, { mode: 0o755 });
        await chmod(fakeBinaryPath, 0o755);

        const encoder = new Lame({ output: outputPath, bitrate: 128 });
        encoder.setFile(inputPath);
        encoder.setLamePath(fakeBinaryPath);

        await encoder.encode();

        const encoded = await readFile(outputPath);

        expect(encoded.equals(Uint8Array.from(inputBuffer))).toBe(true);

        await rm(workdir, { recursive: true, force: true });
    });
});
