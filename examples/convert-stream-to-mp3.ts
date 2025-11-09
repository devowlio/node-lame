import { createReadStream, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

import { createLameEncoderStream } from "./helpers/load-node-lame.js";
import { removeIfExists } from "./helpers/remove-if-exists.js";

const inputPath = resolve(
    fileURLToPath(new URL("./audios/example.wav", import.meta.url)),
);
const outputPath = resolve(
    fileURLToPath(new URL("./audios/example.stream.mp3", import.meta.url)),
);

async function main(): Promise<void> {
    await removeIfExists(outputPath);

    const encoderStream = createLameEncoderStream({
        bitrate: 192,
    });

    encoderStream.getEmitter().on("progress", ([progress, eta]) => {
        process.stdout.write(
            `Streaming progress: ${progress}%${eta ? ` – ETA ${eta}` : ""}\r`,
        );
    });

    await pipeline(
        createReadStream(inputPath),
        encoderStream,
        createWriteStream(outputPath),
    );

    console.log(`Streamed MP3 written to ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
