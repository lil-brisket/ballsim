/**
 * Screenshot the main in-save screens at several widths with Playwright.
 * Needs `npm run dev` (or `npm start`) running and a save in the database.
 *
 * Usage:
 *   npm run ui:shots
 *   npm run ui:shots -- --save=<saveId> --widths=375,1280 --out=screenshots/phase-1
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { chromium, type Page } from "@playwright/test";
import "dotenv/config";

type Screen = {
  name: string;
  /** Path under /dashboard/<saveId>, or a function that finds one. */
  path: string | ((page: Page, base: string) => Promise<string | null>);
  /** Runs after load, e.g. to open a drawer. */
  prepare?: (page: Page) => Promise<void>;
};

const SCREENS: readonly Screen[] = [
  { name: "front-office", path: "" },
  { name: "roster", path: "/roster" },
  { name: "league", path: "/league" },
  {
    name: "player-drawer",
    path: "/roster",
    prepare: async (page) => {
      // Player names open the entity drawer (buttons, not links).
      await page
        .locator("button.font-display.text-xl")
        .filter({ visible: true })
        .first()
        .click();
      await page.getByRole("dialog").first().waitFor({ timeout: 15_000 });
    },
  },
  { name: "trades", path: "/trades/propose" },
  { name: "draft", path: "/draft" },
  { name: "free-agency", path: "/free-agency" },
  { name: "finances", path: "/finances" },
  {
    name: "watch-game",
    path: async (page, base) => {
      // Recent results on Home link to the last played game.
      await page.goto(base);
      const href = await page
        .locator("a[href$='/watch']")
        .first()
        .getAttribute("href")
        .catch(() => null);
      return href;
    },
  },
];

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function firstSaveId(): Promise<string> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set; pass --save=<saveId>.");
  const db = createClient({ url });
  const result = await db.execute(
    'select id from "SaveGame" order by updatedAt desc limit 1',
  );
  const id = result.rows[0]?.id;
  if (typeof id !== "string") throw new Error("No saves in the database.");
  return id;
}

async function main(): Promise<void> {
  const origin = arg("origin") ?? "http://localhost:3000";
  const saveId = arg("save") ?? (await firstSaveId());
  const widths = (arg("widths") ?? "375,1280,1920").split(",").map(Number);
  const out = arg("out") ?? "screenshots";
  const only = arg("only")?.split(",");
  const base = `${origin}/dashboard/${saveId}`;
  mkdirSync(out, { recursive: true });

  const browser = await chromium.launch();
  try {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height: width < 768 ? 812 : 900 },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      for (const screen of SCREENS) {
        if (only && !only.includes(screen.name)) continue;
        const target =
          typeof screen.path === "string"
            ? `${base}${screen.path}`
            : await screen.path(page, base);
        if (!target) {
          console.warn(`skip ${screen.name}: no route found`);
          continue;
        }
        const url = target.startsWith("http") ? target : `${origin}${target}`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 180_000 });
        try {
          await screen.prepare?.(page);
        } catch (error) {
          console.warn(`skip ${screen.name}@${width}: ${String(error)}`);
          continue;
        }
        const file = join(out, `${screen.name}-${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(file);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
