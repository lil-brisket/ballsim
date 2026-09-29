/**
 * Open the Simulation Lab UI at /dev/sim-lab.
 * Starts `npm run dev` when nothing is listening on the Next.js port.
 *
 * Usage:
 *   npm run lab
 */

import { exec, spawn } from "node:child_process";
import { createConnection } from "node:net";

const PORT = Number(process.env.PORT ?? 3000);
const LAB_PATH = "/dev/sim-lab";
const LAB_URL = `http://localhost:${PORT}${LAB_PATH}`;
const READY_TIMEOUT_MS = 45_000;

function assertPort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${port}`);
  }
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => {
      resolve(false);
    });
  });
}

function openBrowser(url: string): void {
  const command =
    process.platform === "win32"
      ? `cmd /c start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(command, (error) => {
    if (error) {
      console.error(`Could not open a browser. Visit ${url}`);
    }
  });
}

async function waitForLab(): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < READY_TIMEOUT_MS) {
    try {
      const response = await fetch(LAB_URL, { redirect: "manual" });
      if (response.status === 200) {
        return;
      }
    } catch {
      // server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for ${LAB_URL}`);
}

function startDevServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "dev"], {
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0 || code === null) {
        resolve();
        return;
      }
      reject(new Error(`npm run dev exited with code ${code}`));
    });
  });
}

async function main(): Promise<void> {
  assertPort(PORT);
  const alreadyRunning = await isPortOpen(PORT);
  if (alreadyRunning) {
    console.log(`Simulation Lab: ${LAB_URL}`);
    openBrowser(LAB_URL);
    return;
  }

  console.log(`Starting Next.js, then opening ${LAB_URL}`);
  const serverDone = startDevServer();
  await waitForLab();
  openBrowser(LAB_URL);
  await serverDone;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Simulation Lab failed: ${message}`);
  process.exitCode = 1;
});
