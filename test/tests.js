const testCase = require("mocha").describe;
const assertions = require("mocha").it;
const assert = require("chai").assert;
const fs = require("fs");
const fsp = require("fs-extra");

const Lame = require("../index").Lame;

testCase("Lame class", () => {
    const TEST_FILE_DURATION = 12; // Audio duration of the TEST_FILE in seconds
    const RESULT_DURATION_TOLERANCE = 1; // Max difference between TEST_FILE duration and converted file duration in seconds
    const EXPECTED_WAV_SIZE = 2142500; // Size of an correctly converted wav file in bytes
    const WAV_SIZE_TOLERANCE = 500; // Max difference between EXPECTED_WAV_SIZE and the actual size of the converted file

    testCase("Encode to .mp3", () => {
        const TEST_FILE = "./test/example.wav";
        const OUTPUT_FILE = "./test/encoded.mp3";

        /**
         * @testname Set invalid wav file
         * Try to convert a .wav file that contains invalid audio data
         */
        assertions("Set invalid wav file", () => {
            let errorCaught = false;
            const targetBitrate = 128;

            const instance = new Lame({
                output: OUTPUT_FILE,
                bitrate: targetBitrate
            });

            instance.setFile("./test/notAWavFile.wav");

            return instance.encode().catch(error => {
                errorCaught = true;

                const expected =
                    "lame: Warning: unsupported audio format\nCan't init infile './test/notAWavFile.wav'";
                const actual = error.message;

                assert.equal(actual, expected);
                assert.isTrue(errorCaught);
            });
        });

        /**
         * @testname Encode file to file
         * Convert a .wav file to a .mp3 file
         */
        assertions("Encode file to file", () => {
            const targetBitrate = 128;

            const instance = new Lame({
                output: OUTPUT_FILE,
                bitrate: targetBitrate
            });

            instance.setFile(TEST_FILE);

            return instance.encode().then(() => {
                // Test expected file duration
                return fsp.stat(OUTPUT_FILE).then(stats => {
                    const size = stats.size;
                    const resultDuration = (size * 8) / (targetBitrate * 1000);
                    fs.unlinkSync(OUTPUT_FILE);

                    const isDurationWithinTolerance =
                        TEST_FILE_DURATION - resultDuration <
                            RESULT_DURATION_TOLERANCE &&
                        TEST_FILE_DURATION - resultDuration >
                            -1 * RESULT_DURATION_TOLERANCE;
                    assert.isTrue(isDurationWithinTolerance);
                });
            });
        });

        /**
         * @testname Encode file to buffer
         * Convert a .wav file to a buffer
         */
        assertions("Encode file to buffer", () => {
            const targetBitrate = 128;
            const output = "buffer";

            const instance = new Lame({
                output: output,
                bitrate: targetBitrate
            });

            instance.setFile(TEST_FILE);

            return instance.encode().then(() => {
                // Test expected file duration
                const buffer = instance.getBuffer();

                const size = buffer.byteLength;
                resultDuration = (size * 8) / (targetBitrate * 1000);

                const isDurationWithinTolerance =
                    TEST_FILE_DURATION - resultDuration <
                        RESULT_DURATION_TOLERANCE &&
                    TEST_FILE_DURATION - resultDuration >
                        -1 * RESULT_DURATION_TOLERANCE;
                assert(isDurationWithinTolerance);
            });
        });

        /**
         * @testname Encode buffer to file
         * Read a .wav file into a buffer. Then convert the buffer to a .mp3 file.
         */
        assertions("Encode buffer to file", () => {
            const targetBitrate = 128;

            return fsp.readFile(TEST_FILE).then(inputBuffer => {
                const instance = new Lame({
                    output: OUTPUT_FILE,
                    bitrate: targetBitrate
                });

                instance.setBuffer(inputBuffer);

                return instance.encode().then(() => {
                    // Test expected file duration
                    return fsp.stat(OUTPUT_FILE).then(stats => {
                        const size = stats.size;
                        const resultDuration =
                            (size * 8) / (targetBitrate * 1000);
                        fs.unlinkSync(OUTPUT_FILE);

                        const isDurationWithinTolerance =
                            TEST_FILE_DURATION - resultDuration <
                                RESULT_DURATION_TOLERANCE &&
                            TEST_FILE_DURATION - resultDuration >
                                -1 * RESULT_DURATION_TOLERANCE;
                        assert.isTrue(isDurationWithinTolerance);
                    });
                });
            });
        });

        /**
         * @testname Encode buffer to buffer
         * Read a .wav file into a buffer. Then convert the buffer to a buffer containing .mp3 data.
         */
        assertions("Encode buffer to buffer", () => {
            const targetBitrate = 128;

            return fsp.readFile(TEST_FILE).then(inputBuffer => {
                const instance = new Lame({
                    output: "buffer",
                    bitrate: targetBitrate
                });
                instance.setBuffer(inputBuffer);

                return instance.encode().then(() => {
                    // Test expected file duration
                    const buffer = instance.getBuffer();

                    const size = buffer.byteLength;
                    const resultDuration = (size * 8) / (targetBitrate * 1000);

                    const isDurationWithinTolerance =
                        TEST_FILE_DURATION - resultDuration <
                            RESULT_DURATION_TOLERANCE &&
                        TEST_FILE_DURATION - resultDuration >
                            -1 * RESULT_DURATION_TOLERANCE;
                    assert.isTrue(isDurationWithinTolerance);
                });
            });
        });
    });

    testCase("Decode to .wav", () => {
        const TEST_FILE = "./test/example.mp3";
        const OUTPUT_FILE = "./test/converted.wav";

        /**
         * @testname Set invalid wav file
         * Try to convert a .mp3 file that contains invalid audio data
         */
        assertions("Set invalid mp3 file", () => {
            let errorCaught = false;
            const targetBitrate = 128;

            const instance = new Lame({
                output: OUTPUT_FILE,
                bitrate: targetBitrate
            });

            instance.setFile("./test/notAnMp3File.mp3");

            return instance.decode().catch(error => {
                errorCaught = true;

                const expected =
                    "lame: Error reading headers in mp3 input file ./test/notAnMp3File.mp3.\nCan't init infile './test/notAnMp3File.mp3'";
                const actual = error.message;

                assert.equal(actual, expected);
                assert.isTrue(errorCaught);
            });
        });

        /**
         * @testname Decode file to file
         * Convert a .mp3 file to a .wav file
         */
        assertions("Decode file to file", () => {
            const targetBitrate = 128;

            const instance = new Lame({
                output: OUTPUT_FILE,
                bitrate: targetBitrate
            });

            instance.setFile(TEST_FILE);

            return instance.decode().then(() => {
                // Test expected file size
                return fsp.stat(OUTPUT_FILE).then(stats => {
                    fs.unlinkSync(OUTPUT_FILE);

                    const actualSize = stats.size;
                    const isSizeWithinTolerance =
                        EXPECTED_WAV_SIZE - actualSize < WAV_SIZE_TOLERANCE &&
                        EXPECTED_WAV_SIZE - actualSize >
                            -1 * WAV_SIZE_TOLERANCE;
                    assert.isTrue(isSizeWithinTolerance);
                });
            });
        });

        /**
         * @testname Decode file to buffer
         * Convert a .mp3 file to a buffer
         */
        assertions("Decode file to buffer", () => {
            const targetBitrate = 128;
            const output = "buffer";

            const instance = new Lame({
                output: output,
                bitrate: targetBitrate
            });

            instance.setFile(TEST_FILE);

            return instance.decode().then(() => {
                // Test expected file size
                const buffer = instance.getBuffer();

                const actualSize = buffer.byteLength;
                const isSizeWithinTolerance =
                    EXPECTED_WAV_SIZE - actualSize < WAV_SIZE_TOLERANCE &&
                    EXPECTED_WAV_SIZE - actualSize > -1 * WAV_SIZE_TOLERANCE;
                assert.isTrue(isSizeWithinTolerance);
            });
        });

        /**
         * @testname Decode buffer to file
         * Read a .mp3 file into a buffer. Then convert the buffer to a .wav file.
         */
        assertions("Decode buffer to file", () => {
            const targetBitrate = 128;

            return fsp.readFile(TEST_FILE).then(inputBuffer => {
                const instance = new Lame({
                    output: OUTPUT_FILE,
                    bitrate: targetBitrate
                });

                instance.setBuffer(inputBuffer);

                return instance.decode().then(() => {
                    // Test expected file size
                    return fsp.stat(OUTPUT_FILE).then(stats => {
                        fs.unlinkSync(OUTPUT_FILE);

                        const actualSize = stats.size;
                        const isSizeWithinTolerance =
                            EXPECTED_WAV_SIZE - actualSize <
                                WAV_SIZE_TOLERANCE &&
                            EXPECTED_WAV_SIZE - actualSize >
                                -1 * WAV_SIZE_TOLERANCE;
                        assert.isTrue(isSizeWithinTolerance);
                    });
                });
            });
        });

        /**
         * @testname Decode buffer to buffer
         * Read a .mp3 file into a buffer. Then convert the buffer to a buffer containing .wav data.
         */
        assertions("Decode buffer to buffer", () => {
            const targetBitrate = 128;

            return fsp.readFile(TEST_FILE).then(inputBuffer => {
                const instance = new Lame({
                    output: "buffer",
                    bitrate: targetBitrate
                });
                instance.setBuffer(inputBuffer);

                return instance.decode().then(() => {
                    // Test expected file size
                    const buffer = instance.getBuffer();

                    const actualSize = buffer.byteLength;
                    const isSizeWithinTolerance =
                        EXPECTED_WAV_SIZE - actualSize < WAV_SIZE_TOLERANCE &&
                        EXPECTED_WAV_SIZE - actualSize >
                            -1 * WAV_SIZE_TOLERANCE;
                    assert.isTrue(isSizeWithinTolerance);
                });
            });
        });
    });

    testCase("Other", () => {
        const TEST_FILE = "./test/example.wav";
        const OUTPUT_FILE = "./test/encoded.mp3";

        /**
         * @testname Option output required
         * Call Lame constructor with empty options object
         */
        assertions("Option output required", () => {
            let errorCaught = false;

            try {
                const instance = new Lame({});
            } catch (error) {
                errorCaught = true;
                const expected = "lame: Invalid option: 'output' is required";
                const actual = error.message;

                assert.equal(actual, expected);
            }

            assert.isTrue(errorCaught);
        });

        /**
         * @testname Option bitrate is required
         * Call Lame constructor with no bitrate specified in options object
         */
        assertions("Option bitrate is required", () => {
            let errorCaught = false;

            const instance = new Lame({
                output: OUTPUT_FILE
            });

            instance.setFile("./test/notAWavFile.wav");

            return instance.encode().catch(error => {
                errorCaught = true;

                const expected =
                    "lame: Warning: unsupported audio format\nCan't init infile './test/notAWavFile.wav'";
                const actual = error.message;

                assert.equal(actual, expected);
                assert.isTrue(errorCaught);
            });
        });

        /**
         * @testname Set not existing file
         * Try to convert not existing file
         */
        assertions("Set not existing file", () => {
            let errorCaught = false;

            try {
                const instance = new Lame({
                    output: OUTPUT_FILE
                });

                instance.setFile("./test/not-existing.wav");
            } catch (error) {
                errorCaught = true;

                const expected = "Audio file (path) dose not exist";
                const actual = error.message;

                assert.equal(actual, expected);
            }

            assert.isTrue(errorCaught);
        });

        /**
         * @testname Get status object before start
         * Setup the converter properly, then read the status object without calling the encode function.
         */
        assertions("Get status object before start", () => {
            const targetBitrate = 128;

            const instance = new Lame({
                output: OUTPUT_FILE,
                bitrate: targetBitrate
            });

            instance.setFile(TEST_FILE);

            const actual = instance.getStatus();

            const expected = {
                started: false,
                finished: false,
                progress: undefined,
                eta: undefined
            };

            assert.deepEqual(actual, expected);
        });

        /**
         * @testname Get status object during converting
         * Setup the converter properly, call the encode function and immediately read the status object.
         */
        assertions("Get status object during converting", () => {
            const targetBitrate = 128;

            const instance = new Lame({
                output: OUTPUT_FILE,
                bitrate: targetBitrate
            });

            instance.setFile(TEST_FILE);
            const emitter = instance.getEmitter();

            instance.encode().then(() => {
                fs.unlinkSync(OUTPUT_FILE);
            });

            const actual = instance.getStatus();
            const expected = {
                started: true,
                finished: false,
                progress: 0,
                eta: undefined
            };

            assert.deepEqual(actual, expected);

            // Ensure next test will executed after finishing encoding
            return new Promise(resolve => {
                emitter.on("finish", resolve);
            });
        });

        /**
         * @testname Get status object after converting
         * Setup the converter properly, call the encode function and read the status object afterwards.
         */
        assertions("Get status object after converting", () => {
            const targetBitrate = 128;

            const instance = new Lame({
                output: OUTPUT_FILE,
                bitrate: targetBitrate
            });

            instance.setFile(TEST_FILE);

            return instance.encode().then(() => {
                const actual = instance.getStatus();

                const expected = {
                    started: true,
                    finished: true,
                    progress: 100,
                    eta: "00:00"
                };

                fs.unlinkSync(OUTPUT_FILE);
                assert.deepEqual(actual, expected);
            });
        });

        /**
         * @testname Get status eventEmitter successful converting
         * Setup the converter properly, call the encode function and check if progress and finish were emitted.
         */
        assertions("Get status eventEmitter successful converting", () => {
            const targetBitrate = 128;

            const instance = new Lame({
                output: OUTPUT_FILE,
                bitrate: targetBitrate
            });

            instance.setFile(TEST_FILE);

            const emitter = instance.getEmitter();

            let progressTriggered = false;
            let finishTriggered = false;

            emitter.on("progress", () => {
                progressTriggered = true;
            });

            emitter.on("finish", () => {
                finishTriggered = true;

                fs.unlinkSync(OUTPUT_FILE);
            });

            emitter.on("error", error => {
                assert.isTrue(false);
            });

            return instance.encode().then(() => {
                // error expected is irrelevant for this test
                assert.isTrue(progressTriggered);
                assert.isTrue(finishTriggered);
            });
        });

        /**
         * @testname Get status eventEmitter unsuccessful converting
         * Setup the converter with invalid source file, call the encode function and check if an error is emitted.
         */
        assertions("Get status eventEmitter unsuccessful converting", () => {
            const targetBitrate = 128;

            const instance = new Lame({
                output: OUTPUT_FILE,
                bitrate: targetBitrate
            });

            instance.setFile("./test/notAWavFile.wav");

            const emitter = instance.getEmitter();

            let errorTriggered = false;

            emitter.on("error", error => {
                errorTriggered = true;
            });

            return instance.encode().catch(() => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        assert.isTrue(errorTriggered);

                        resolve();
                    }, 500);
                });
            });
        });

        /**
         * @testname Options
         * Specify optional Options and check if they are set in the options object.
         */
        assertions("Options", () => {
            const instance = new Lame({
                output: OUTPUT_FILE,
                bitrate: 128,
                raw: true,
                "swap-bytes": true,
                sfreq: 22.05,
                bitwidth: 32,
                signed: true,
                unsigned: true,
                "little-endian": true,
                "big-endian": true,
                mp2Input: true,
                mp3Input: true,
                mode: "r",
                "to-mono": true,
                "channel-different-block-sizes": true,
                freeformat: "FreeAmp",
                "disable-info-tag": true,
                comp: 5,
                scale: 2,
                "scale-l": 1,
                "scale-r": 3,
                "replaygain-fast": true,
                "replaygain-accurate": true,
                "no-replaygain": true,
                "clip-detect": true,
                preset: "medium",
                noasm: "sse",
                quality: 3,
                "force-bitrate": true,
                cbr: true,
                abr: 45,
                vbr: true,
                "vbr-quality": 6,
                "ignore-noise-in-sfb21": true,
                emp: "5",
                "mark-as-copyrighted": true,
                "mark-as-copy": true,
                "crc-error-protection": true,
                nores: true,
                "strictly-enforce-ISO": true,
                lowpass: 55,
                "lowpass-width": 9,
                highpass: 400,
                "highpass-width": 4,
                resample: 44.1,
                meta: {
                    title: "test title",
                    artist: "test artist",
                    album: "test album",
                    year: "2017",
                    comment: "test comment",
                    track: "3",
                    genre: "test genre",
                    artwork: "testpic.jpg",
                    "add-id3v2": true,
                    "id3v1-only": true,
                    "id3v2-only": true,
                    "id3v2-latin1": true,
                    "id3v2-utf16": true,
                    "space-id3v1": true,
                    "pad-id3v2": true,
                    "pad-id3v2-size": 2,
                    "ignore-tag-errors": true,
                    "genre-list": "test, genres"
                }
            });
            instance.setFile(TEST_FILE);

            expected = [
                "-b",
                128,
                "-r",
                "-x",
                "-s",
                22.05,
                "--bitwidth",
                32,
                "--signed",
                "--unsigned",
                "--little-endian",
                "--big-endian",
                "--mp2input",
                "--mp3input",
                "-m",
                "r",
                "-a",
                "-d",
                "--freeformat",
                "FreeAmp",
                "-t",
                "--comp",
                5,
                "--scale",
                2,
                "--scale-l",
                1,
                "--scale-r",
                3,
                "--replaygain-fast",
                "--replaygain-accurate",
                "--noreplaygain",
                "--clipdetect",
                "--preset",
                "medium",
                "--noasm",
                "sse",
                "-q",
                3,
                "-F",
                "--cbr",
                "--abr",
                45,
                "-v",
                "-V",
                6,
                "-Y",
                "-e",
                "5",
                "-c",
                "-o",
                "-p",
                "--nores",
                "--strictly-enforce-ISO",
                "--lowpass",
                55,
                "--lowpass-width",
                9,
                "--highpass",
                400,
                "--highpass-width",
                4,
                "--resample",
                44.1,
                "--tt",
                "test title",
                "--ta",
                "test artist",
                "--tl",
                "test album",
                "--ty",
                "2017",
                "--tc",
                "test comment",
                "--tn",
                "3",
                "--tg",
                "test genre",
                "--ti",
                "testpic.jpg",
                "--add-id3v2",
                "--id3v1-only",
                "--id3v2-only",
                "--id3v2-latin1",
                "--id3v2-utf16",
                "--space-id3v1",
                "--pad-id3v2",
                "--pad-id3v2-size",
                "2",
                "--ignore-tag-errors",
                "--genre-list",
                "test, genres"
            ];

            const actual = instance.args;
            assert.deepEqual(expected, actual);
        });
    });
});
