/**
 * First-load JavaScript per main screen, measured in a real browser against a
 * running production build (`npm run build` then `npm run start`, both with
 * DATABASE_URL=file:./prisma/e2e.db after `npm run e2e:seed`).
 *
 * Counts every JavaScript response fetched until the page is idle on a cold
 * load (cache disabled; median of three runs): encoded (transfer, usually brotli/gzip) and decoded
 * bytes. Lazily loaded chunks requested only after interaction are not
 * counted, which is the point of moving code behind next/dynamic.
 *
 * Usage:
 *   npx tsx scripts/first-load-js.ts [--base=http://localhost:3000] [--save=e2e-regular-season]
 *
 * For the Turbopack module graph itself use `npx next analyze`.
 */

import { chromium, type Page } from "@playwright/test";

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const base = arg("base", "http://localhost:3000");
const save = arg("save", "e2e-regular-season");
const RUNS = 3;

type Screen = {
  name: string;
  path: string | ((page: Page) => Promise<string | null>);
};

const SCREENS: readonly Screen[] = [
  { name: "Home", path: `/dashboard/${save}` },
  { name: "Roster", path: `/dashboard/${save}/roster` },
  {
    name: "Watch Game",
    path: async (page) => {
      // Recent results on Home link to played games; watch the first one.
      await page.goto(`${base}/dashboard/${save}`, {
        waitUntil: "networkidle",
      });
      const href = await page
        .locator("a[href*='/games/']")
        .first()
        .getAttribute("href")
        .catch(() => null);
      return href ? `${href.replace(/\/watch$/, "")}/watch` : null;
    },
  },
  { name: "Draft", path: `/dashboard/${save}/draft` },
];

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function measure(page: Page, url: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const scripts = new Map<string, { encoded: number; decoded: number }>();
  const pending = new Map<string, string>();
  cdp.on("Network.responseReceived", (event) => {
    if (event.type === "Script")
      pending.set(event.requestId, event.response.url);
  });
  cdp.on("Network.dataReceived", (event) => {
    const url = pending.get(event.requestId);
    if (!url) return;
    const entry = scripts.get(url) ?? { encoded: 0, decoded: 0 };
    entry.decoded += event.dataLength;
    scripts.set(url, entry);
  });
  cdp.on("Network.loadingFinished", (event) => {
    const url = pending.get(event.requestId);
    if (!url) return;
    const entry = scripts.get(url) ?? { encoded: 0, decoded: 0 };
    entry.encoded = event.encodedDataLength;
    scripts.set(url, entry);
  });
  await page.goto(url, { waitUntil: "networkidle" });
  await cdp.detach();
  let encoded = 0;
  let decoded = 0;
  for (const entry of scripts.values()) {
    encoded += entry.encoded;
    decoded += entry.decoded;
  }
  return { files: scripts.size, encoded, decoded };
}

async function main() {
  const browser = await chromium.launch();
  const rows: string[] = [
    "| Screen | JS files | Transferred | Parsed size |",
    "| --- | ---: | ---: | ---: |",
  ];
  for (const screen of SCREENS) {
    const finder = await browser.newPage();
    const path =
      typeof screen.path === "string" ? screen.path : await screen.path(finder);
    await finder.close();
    if (!path) {
      rows.push(`| ${screen.name} | — | not found | — |`);
      continue;
    }
    // Median of three cold loads (prefetching makes single runs noisy); a
    // fresh context each time: no shared cache, no moment "seen" state.
    const runs: Array<Awaited<ReturnType<typeof measure>>> = [];
    for (let i = 0; i < RUNS; i += 1) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
      });
      runs.push(await measure(await context.newPage(), `${base}${path}`));
      await context.close();
    }
    runs.sort((a, b) => a.encoded - b.encoded);
    const result = runs[Math.floor(runs.length / 2)]!;
    rows.push(
      `| ${screen.name} | ${result.files} | ${kb(result.encoded)} | ${kb(result.decoded)} |`,
    );
  }
  await browser.close();
  console.log(rows.join("\n"));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
