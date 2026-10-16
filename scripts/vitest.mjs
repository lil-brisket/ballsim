// Starts the Vitest CLI from the OS-canonical working directory.
//
// On Windows, Vitest 4 loads `@vitest/runner` twice when the cwd has a
// lowercase drive letter (`c:\…`, which VS Code and some agent shells use).
// Every test file then fails at its first `describe()` with "Cannot read
// properties of undefined (reading 'config')" (issue #96,
// vitest-dev/vitest#10812). The casing has to be right before Vitest loads,
// so the npm test scripts run Vitest through this file.
import { realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (process.platform === "win32") {
  process.chdir(realpathSync.native(process.cwd()));
}

const vitestCli = path.join(
  process.cwd(),
  "node_modules",
  "vitest",
  "vitest.mjs",
);
await import(pathToFileURL(vitestCli).href);
