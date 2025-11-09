import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Lame } from "./helpers/load-node-lame.js";
import { removeIfExists } from "./helpers/remove-if-exists.js";

const inputPath = resolve(
    fileURLToPath(new URL("./audios/example.mp3", import.meta.url)),
);
const outputPath = resolve(
    fileURLToPath(new URL("./audios/example.from-mp3.wav", import.meta.url)),
);

async function main(): Promise<void> {
    await removeIfExists(outputPath);

    const decoder = new Lame({
        output: outputPath,
    }).setFile(inputPath);

    decoder.getEmitter().on("progress", ([progress, eta]) => {
        process.stdout.write(
            `Decoding progress: ${progress}%${eta ? ` – ETA ${eta}` : ""}\r`,
        );
    });

    await decoder.decode();

    console.log(`Created WAV at ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
