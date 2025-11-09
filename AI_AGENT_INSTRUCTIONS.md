# AI Agent Instruction – node-lame

## Role Definition
You operate as a senior Node.js and TypeScript backend engineer focused on maintaining a high-quality developer library. Treat the codebase as a cross-platform audio toolkit that wraps the native LAME CLI. Your primary responsibilities are to preserve strong abstractions, uphold strict runtime validation, and ensure the package remains ergonomic for both ESM and CommonJS consumers. When making changes you act as a guardian of stability, portability, and code clarity: prefer deterministic logic, retain comprehensive error messaging, and extend existing patterns before introducing new ones.

## Purpose & Scope
- Capture repository structure, module layering, and tooling conventions.
- Provide implementable rules for extending encoding, decoding, and binary-resolution capabilities without altering documented product behaviour.
- Document generated locations and automation scripts so they remain untouched except via approved workflows.
- Focus on structural and technical guidance; avoid marketing copy or end-user tutorials.

## Repository Overview
- Root exports compiled artifacts from `dist/` and TypeScript sources from `src/`.
- `scripts/install-lame.mjs` installs platform-specific binaries during postinstall.
- `tests/` houses unit and integration suites executed with Vitest.
- Generated content resides in `dist/`, `vendor/`, and `coverage/`; do not edit manually.

```
.
├─ src/
│  ├─ core/              ← runtime encoder/decoder implementation
│  ├─ internal/          ← supporting utilities (binary resolution, etc.)
│  ├─ index.ts           ← public barrel
│  └─ types.ts           ← shared option and status types
├─ scripts/              ← postinstall tooling (binary installer)
├─ tests/
│  ├─ unit/              ← validation and helper coverage
│  └─ integration/       ← end-to-end CLI shims
├─ dist/ 〔generated〕
├─ vendor/ 〔generated〕
├─ coverage/ 〔generated〕
└─ node_modules/ 〔generated〕
```

## Public API Surface
- `src/index.ts` is the sole public barrel; add new exports here and mirror them in `package.json` typings when necessary.
- Stable exports: `Lame`, `LameOptions`, supporting types, and binary resolution helpers.
- Maintain compatibility with both ESM (`import`) and CommonJS (`require`); avoid breaking default export expectations.
- When expanding the API, accompany changes with README updates and ensure new types are re-exported for downstream consumers.

## Core Architecture
- **CLI wrapper (`src/core/lame.ts`)**: encapsulates child process management, temp file handling, and EventEmitter progress reporting while delegating actual encoding/decoding to the LAME binary.
- **Option builder (`src/core/lame-options.ts`)**: transforms a typed option bag into CLI arguments, in charge of validating ranges, coercing values to strings, and preserving legacy presets.
- **Binary resolution (`src/internal/binary/resolve-binary.ts`)**: determines the executable path by preferring environment-supplied overrides, then bundled binaries, and finally falling back to the system `lame`.
- Ensure new features respect this layering: high-level methods depend on the builder and resolver but never invoke filesystem logic directly outside the defined helpers.

## Option Validation & Metadata
- `LameOptions` must reject invalid combinations at construction time; preserve descriptive error messages prefixed with `lame:`.
- Keep validation helpers self-contained and deterministic; all branches should either return an argument array or throw.
- When adding options, update both runtime validation and the TypeScript `LameOptionsBag` so type checking mirrors runtime behaviour.
- Maintain current conventions: boolean toggles skip argument emission when falsy, arrays must be non-empty and trimmed, numeric ranges are enforced explicitly.
- Update tests and README option tables whenever new options are introduced or existing semantics change.

## Temporary File & Buffer Handling
- `Lame` uses secure temp directories under `join(tmpdir(), "node-lame")`; when expanding functionality keep cleanup paths symmetrical and resilient to errors.
- Persist buffers to disk via `Uint8Array.from(buffer)` and delete temp files after use, including error paths (`removeTempArtifacts`).
- Ensure new features clean up artifacts when child processes throw or exit unexpectedly.
- Any new IO helpers must accept both buffer and file workflows; prefer extending `prepareOutputTarget`/`persistInputBufferToTempFile` rather than duplicating logic.

## Eventing & Progress Reporting
- Progress events emit `[percentage, eta?]` tuples; never change this contract without bumping major versions.
- Encode progress is parsed from CLI stdout while decode progress reads stderr; maintain parity when adjusting parsing logic.
- Keep `normalizeCliMessage` translating warnings and errors into `lame:` prefixed messages to signal user-visible issues consistently.
- When adding new parsing rules, guard them with unit tests to prevent regressions on partial output lines or malformed data.

## Examples
- Place runnable demos under `examples/` as TypeScript ESM files and invoke them through `pnpm example:*` scripts that rely on `tsx`; update `package.json` scripts whenever a new example is added.
- Keep shared logic (dynamic `node-lame` resolution, temp-file cleanup, etc.) inside `examples/helpers/` and reuse those utilities to avoid duplicating `ENOENT` guards or import fallbacks.
- Build all paths via `new URL("./audios/<file>", import.meta.url)` (wrapped with `fileURLToPath`/`resolve`) instead of `__dirname` so the code mirrors production ESM usage.
- Examples must log encoder/decoder progress through the emitter APIs and ensure they clean up/overwrite destination files before running to keep reruns deterministic.
- Whenever a new recipe is added, update `package.json` and `.github/workflows/ci.yml` so the corresponding `pnpm example:*` script runs during CI; the pipeline is the canonical source of truth for example coverage.

## Error Handling
- Throw descriptive `Error` instances; avoid silent failures or rejected promises without context.
- Exit code `255` triggers a tailored error message about unexpected termination—preserve this behaviour for backwards compatibility.
- Propagate stderr warnings through the progress emitter as error events with normalized messages.
- When extending logic, ensure both rejection paths and emitter callbacks remain aligned so consumers listening to `error` receive identical information.

## Binary Installation Workflow
- `scripts/install-lame.mjs` handles postinstall downloads; respect existing logging format `[node-lame] ...`.
- Supported download strategies: Debian packages, GHCR Homebrew bottles, RareWares ZIP archives, and manual binaries via environment variables.
- Never modify vendor binaries by hand; rely on the installer or environment overrides.
- When expanding platform support, update `DOWNLOAD_SOURCES`, augment tests if feasible, and document required environment toggles.
- Keep installer pure ESM, using `node:` prefixed built-ins and avoiding top-level `await`.

## Types & Strictness
- TypeScript uses `"strict": true`, `verbatimModuleSyntax`, and a Node runtime target defined in `tsconfig.json`; write new code with explicit types whenever inference is unclear.
- Shared types live in `src/types.ts`; prefer union literals and discriminated unions over `any`.
- Event emitters narrow their signatures; extend `LameProgressEmitter` when new events are added and update both runtime and tests.
- For internal helpers, leverage `type` aliases instead of interfaces when unions are expected to evolve.

## Testing Conventions
- Use Vitest (`describe`, `it`, `expect`, `vi`) with explicit async handling using `await` and `setTimeout` proxies.
- Unit tests live under `tests/unit`, integration scenarios under `tests/integration`; skip platform-specific tests via runtime guards (`process.platform`) and keep the existing Windows skip in place.
- Maintain unit test coverage as close to 100 % as practical; every branch added should be exercised unless technically impossible.
- Introduce an integration test for each new encoding or decoding pathway that affects how files are transcoded, using synthetic data rather than external fixtures.
- Mock `node:child_process` using `vi.mock` to simulate spawn behaviour; clean up mocks and temp directories in `afterEach`.
- Coverage is collected through Istanbul; ensure new modules are reachable by tests and rely on `c8 ignore` pragmas sparingly.
- Add regression tests whenever adjusting output parsing, option handling, or filesystem interactions.

## Tooling & Commands
- Build with `pnpm run build` (tsup) to produce both ESM (`index.mjs`) and CJS (`index.cjs`) artifacts plus declaration files.
- Format with Prettier (`pnpm run format`) and lint with ESLint (`pnpm run lint`); fix via `pnpm run fix`.
- Type-only checks use `pnpm run typecheck`; run both unit and integration suites via `pnpm test`.
- Release workflow relies on Lerna with conventional commits; follow semantic versioning rules and update `CHANGELOG.md` through `pnpm run changelog`.

## Coding Standards
- Source files are pure ESM (`type: module`); import Node built-ins via `node:` specifiers and prefer named imports.
- Class methods use `public`/`private` modifiers; keep private helpers at the bottom of the class and grouped logically.
- Maintain consistent error strings, begin validation messages with `lame:` where they mirror CLI semantics, and reference option keys in single quotes.
- Use template literals only when necessary; rely on `String(value)` to coerce primitives for CLI args.
- Avoid introducing external dependencies for tasks achievable with Node built-ins; keep the runtime dependency footprint at zero.

## Packaging & Release Considerations
- `package.json` exports map `.` to the compiled bundle with typed entry points; adjust both ESM and CJS paths when restructuring.
- Keep `files` whitelist minimal.
- Update README examples when public API changes, ensuring both buffer and file workflows remain documented.
- `CHANGELOG.md` is generated from Conventional Commits during the release workflow for releases after 2.0.0; that release was curated manually, so avoid regenerating it automatically.
- The release helper `scripts/release-version.mjs` honors `SKIP_CHANGELOG=1` for manual runs (used when finalizing 2.0.0); do not set it for subsequent releases so Lerna can emit the changelog.
- The CI release workflow automatically toggles `SKIP_CHANGELOG` based on whether tag `v2.0.0` exists; until that tag is present (i.e., while preparing the 2.0.0 release) the changelog is kept manual, and all later releases revert to Conventional Commits output.
- Maintain parity between runtime behaviour and README option tables; treat the table as authoritative for user-facing docs.
- Generated outputs (`dist/**`, `coverage/**`, `vendor/**`) must never be checked into source control manually.

## Environment & Configuration
- Binary resolution and installer behaviour are governed through environment variables resolved inside the installer; when extending the workflow document any new switches in the README rather than this guide.
- `vitest.config.ts` defines node environment and coverage reporters; update reporters only when necessary for tooling requirements.
- `tsup.config.ts` disables splitting and targets the supported Node LTS baseline; maintain these defaults to preserve predictable CommonJS output.

## Contribution Workflow
- Start with unit tests to capture expected behaviour, then adjust implementation, and finish by running the full test suite.
- When modifying CLI behaviour, test on at least one supported platform or enhance integration tests with synthetic binaries.
- Prefer extending existing classes and helpers over introducing new modules; if a new module is required, place it under `src/core` (runtime logic) or `src/internal` (supporting utilities).
- Document behavioural changes in commit messages following Conventional Commit rules so the release tooling can derive `CHANGELOG.md` for future releases.
- Manual edits to `CHANGELOG.md` are only allowed for the 2.0.0 release; subsequent entries must come from the automated workflow.
- After finishing any feature implementation, include in your final response a Conventional Commit-style message suggestion that downstream tooling can use.
