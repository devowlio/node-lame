import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Lame } from "./helpers/load-node-lame.js";
import { removeIfExists } from "./helpers/remove-if-exists.js";

const inputPath = resolve(
    fileURLToPath(new URL("./audios/example.wav", import.meta.url)),
);
const outputPath = resolve(
    fileURLToPath(new URL("./audios/example.from-wav.mp3", import.meta.url)),
);

async function main(): Promise<void> {
    await removeIfExists(outputPath);

    const encoder = new Lame({
        output: outputPath,
        bitrate: 192,
    });

    encoder.setFile(inputPath);

    encoder.getEmitter().on("progress", ([progress, eta]) => {
        process.stdout.write(
            `Encoding progress: ${progress}%${eta ? ` – ETA ${eta}` : ""}\r`,
        );
    });

    await encoder.encode();

    console.log(`Created MP3 at ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
