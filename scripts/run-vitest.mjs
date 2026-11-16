// Starts Vitest from an upper-case drive letter on Windows.
//
// A terminal opened on "c:\NISAFETY_CODER" (VS Code does this) instead of
// "C:\NISAFETY_CODER" makes Vitest load two copies of itself, and every
// test file fails with "Vitest failed to find the current suite". Fixing
// the working directory before Vitest starts avoids it. No-op elsewhere.
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const fixed = process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase());
if (fixed !== process.cwd()) process.chdir(fixed);

const require = createRequire(`${fixed}/package.json`);
// The CLI entry (vitest.mjs) isn't in vitest's "exports", so locate it via package.json.
const cli = require.resolve("vitest/package.json").replace(/package\.json$/, "vitest.mjs");
await import(pathToFileURL(cli).href);
