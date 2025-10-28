import { describe, expect, it } from "vitest";
import { LameOptions } from "../../src/core/lame-options";
import type { LameOptionsBag } from "../../src/types";

describe("LameOptions", () => {
    it("throws when output option is missing", () => {
        expect(() => new LameOptions({} as LameOptionsBag)).toThrow(
            "lame: Invalid option: 'output' is required",
        );
    });

    it("builds arguments for basic configuration", () => {
        const options: LameOptionsBag = {
            output: "buffer",
            bitrate: 128,
            vbr: true,
            meta: {
                title: "Test",
                artist: "Node Lame",
            },
        };

        const builder = new LameOptions(options);
        const args = builder.getArguments();

        expect(args).toContain("-b");
        expect(args).toContain("128");
        expect(args).toContain("-v");
        expect(args).toContain("--tt");
        expect(args).toContain("Test");
    });
});
