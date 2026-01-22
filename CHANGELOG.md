# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## <small>2.0.2 (2026-01-22)</small>

- fix: export seperate typings for CommonJS consumers (#48) ([e029cfb](https://github.com/devowlio/node-lame/commit/e029cfb)), closes [#48](https://github.com/devowlio/node-lame/issues/48)
- fix: exports for ESM consumers (#48) ([b66610e](https://github.com/devowlio/node-lame/commit/b66610e)), closes [#48](https://github.com/devowlio/node-lame/issues/48)
- chore(deps): bump tar from 7.5.2 to 7.5.4 ([207d16f](https://github.com/devowlio/node-lame/commit/207d16f))

## <small>2.0.2 (2026-01-22)</small>

- fix: export seperate typings for CommonJS consumers (#48) ([e029cfb](https://github.com/devowlio/node-lame/commit/e029cfb)), closes [#48](https://github.com/devowlio/node-lame/issues/48)
- fix: exports for ESM consumers (#48) ([b66610e](https://github.com/devowlio/node-lame/commit/b66610e)), closes [#48](https://github.com/devowlio/node-lame/issues/48)
- chore(deps): bump tar from 7.5.2 to 7.5.4 ([207d16f](https://github.com/devowlio/node-lame/commit/207d16f))

## <small>2.0.1 (2026-01-15)</small>

- fix: missing scripts in shipped tarball for installation (#47) ([0c100d2](https://github.com/devowlio/node-lame/commit/0c100d2)), closes [#47](https://github.com/devowlio/node-lame/issues/47)
- docs: changelog correction for first release with changelog ([2d0e35d](https://github.com/devowlio/node-lame/commit/2d0e35d))

## <small>2.0.1 (2026-01-15)</small>

- fix: missing scripts in shipped tarball for installation (#47) ([0c100d2](https://github.com/devowlio/node-lame/commit/0c100d2)), closes [#47](https://github.com/devowlio/node-lame/issues/47)
- docs: changelog correction for first release with changelog ([2d0e35d](https://github.com/devowlio/node-lame/commit/2d0e35d))

## 2.0.0 (2025-11-09)

### Breaking Changes

- Postinstall now auto-downloads a platform-specific LAME binary into `vendor/lame/<platform>-<arch>/`. Pipelines must permit the download step or configure `LAME_BINARY`, `LAME_SKIP_DOWNLOAD`, or `LAME_FORCE_DOWNLOAD` to control it (more details see `README.md`).
- The minimum Node.js version is 20 and the library is published as an ESM-first package with explicit `exports`. CommonJS imports are still supported. Deep imports like `require("node-lame/lib/...")` are no longer supported.

### Features

- Introduced duplex streaming helpers (`createLameEncoderStream` / `createLameDecoderStream`) so audio can flow through stdin/stdout while progress events continue to fire ([#11](https://github.com/devowlio/node-lame/issues/11)).
- `Lame#setBuffer` accepts `ArrayBuffer` and all typed arrays, automatically normalizing samples to the requested bit depth and endianness ([#33](https://github.com/devowlio/node-lame/issues/33)).
- Broadened CLI option support: gapless playback controls, priority/disptime tuning, channel swapping, gain, decode delay trimming, VBR fine-tuning, verbosity toggles, and custom ID3 frames via `meta.custom`.
- Exported `resolveBundledLameBinary` and `resolveLameBinary` so applications can inspect or override the binary chosen at runtime.

### Improvements

- `spawnLameProcess` now drives all CLI interaction, guaranteeing consistent progress parsing and normalized warning/error messages.
- Temp files live under `join(tmpdir(), "node-lame")`, are created lazily, and are cleaned up automatically, even after failures.
- Documentation now covers the installer environment variables, typed-array ingestion, gapless workflows, and streaming usage.

### Tooling & Quality

- Builds now originate from modern TypeScript sources compiled by `tsup` into dual ESM/CJS bundles with generated typings.
- Vitest-based unit and integration suites stub binaries, simulate streaming backpressure, and assert option coverage.
- The installer maintains a deterministic vendor layout, making binary resolution reproducible across platforms.
- Introduced CI/CD pipelines that lint, type-check, run unit and integration suites, and gate release publishing so every change ships through the same automated path.

## 1.5.1 (2025-10-28)

All releases up to this version were created **without** a changelog. Please refer to the comment messages for details on changes!

**Summary of features in version 1.x:**

- Promise-based Node.js wrapper for the native LAME CLI that can both encode WAV/MP1/MP2/MP3 sources to MP3 and decode MP3 files back to WAV while reporting progress through `getStatus()` and an `EventEmitter` (`progress`, `finish`, `error`).
- Supports file- and buffer-based workflows for both inputs and outputs, including optional in-memory pipelines, configurable temp directories, and custom binary paths so projects can bundle their own LAME builds.
- Provides raw PCM ingestion controls (sample frequency, bit width, signed/unsigned, endian toggles) and format hints (`mp2Input`, `mp3Input`) so the CLI can be tuned for atypical sources.
- Exposes the majority of LAME’s encoding knobs: stereo/joint/mono modes, mono downmix (`to-mono`), block-size tweaks, ReplayGain detection, channel scaling, presets, CPU feature flags, quality ladders, and the full suite of bitrate strategies (constant, forced, average, variable with quality targets, and noise-shaping helpers).
- Includes resampling plus low-pass/high-pass filter controls and ISO-compliance/reservoir toggles for shaping output to device requirements or archival specs.
- Ships rich ID3 tooling that can embed titles, artists, albums, years, comments, tracks, genres, artwork, genre lists, padding, and ID3v1/v2 variants while allowing strict tag validation.
- Publishes TypeScript typings alongside the compiled library and maintains a Mocha/Chai suite that exercises encode/decode happy paths, buffer handling, metadata arguments, and failure cases (bad files, invalid options, unexpected process exits).
