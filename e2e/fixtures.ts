import { createClient } from "@libsql/client";
import { test as base, expect, type Page } from "@playwright/test";
import "dotenv/config";

let cachedSaveId: Promise<string> | undefined;

/** E2E_SAVE_ID, or the most recently updated save in the local database. */
export function saveId(): Promise<string> {
  cachedSaveId ??= (async () => {
    if (process.env.E2E_SAVE_ID) return process.env.E2E_SAVE_ID;
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Set DATABASE_URL or E2E_SAVE_ID.");
    const result = await createClient({ url }).execute(
      'select id from "SaveGame" order by updatedAt desc limit 1',
    );
    const id = result.rows[0]?.id;
    if (typeof id !== "string") {
      throw new Error("No saves in the database; create one in the app.");
    }
    return id;
  })();
  return cachedSaveId;
}

/** Console errors, uncaught exceptions and 5xx responses seen by a page. */
export function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const lines = message.text().split("\n");
    // Keep React's +/- diff lines so hydration mismatches say what differed.
    const diff = lines.filter((line) => /^\s*[+-]\s/.test(line)).slice(0, 12);
    problems.push(
      [`console: ${lines[0]!.slice(0, 300)}`, ...diff].join("\n").trimEnd(),
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      problems.push(`${response.status()} ${response.url()}`);
    }
  });
  return problems;
}

/**
 * Elements wider than the viewport, outlined in red for the failure
 * screenshot. Empty when nothing scrolls sideways.
 */
export async function horizontalOverflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= width + 1) return [];
    const offenders: string[] = [];
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.right <= width + 1) continue;
      // Report the outermost offender only.
      const parent = element.parentElement?.getBoundingClientRect();
      if (parent && parent.right > width + 1) continue;
      (element as HTMLElement).style.outline = "2px solid red";
      const id = element.id ? `#${element.id}` : "";
      const cls =
        typeof element.className === "string"
          ? `.${element.className.trim().split(/\s+/).slice(0, 3).join(".")}`
          : "";
      offenders.push(
        `${element.tagName.toLowerCase()}${id}${cls} (right ${Math.round(rect.right)}px)`,
      );
    }
    return offenders.slice(0, 10);
  });
}

export const test = base.extend<{ dashboard: (path?: string) => string }>({
  // `provide` is Playwright's fixture `use`; renamed so the React hooks lint
  // rule does not mistake it for a hook.
  dashboard: async ({}, provide) => {
    const id = await saveId();
    await provide((path = "") => `/dashboard/${id}${path}`);
  },
});

export { expect };
