import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guardrails for the visual polish design rules (see the top of
 * src/components/ui/styles.ts). Fails on patterns the polish phases removed
 * so they do not creep back in.
 */

const SRC = path.join(process.cwd(), "src");
const UI_DIR = path.join(SRC, "components", "ui") + path.sep;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(name) ? [full] : [];
  });
}

const FILES = sourceFiles(SRC).map((file) => ({
  file: path.relative(process.cwd(), file).replaceAll("\\", "/"),
  inUi: file.startsWith(UI_DIR),
  text: readFileSync(file, "utf8"),
}));

/** `file:line` for every line matching `pattern`. */
function offenders(
  pattern: RegExp,
  include: (entry: (typeof FILES)[number]) => boolean = () => true,
): string[] {
  return FILES.filter(include).flatMap(({ file, text }) =>
    text
      .split(/\r?\n/)
      .flatMap((line, i) => (pattern.test(line) ? [`${file}:${i + 1}`] : [])),
  );
}

describe("style guard", () => {
  it("imports shared primitives from components/ui, not the removed owner copies", () => {
    expect(
      offenders(
        /components\/owner\/(EmptyState|Section|PageHeader|StatusBadge|DataTable|StatCard|TeamBadge)["']/,
      ),
    ).toEqual([]);
  });

  it("uses team or warning tokens instead of raw amber classes", () => {
    expect(offenders(/outline-amber-500/)).toEqual([]);
    expect(
      offenders(
        /(^|[\s"'`:])[a-z-]*amber-\d{2,3}\b/,
        ({ file }) => file.endsWith(".tsx") || file.endsWith(".ts"),
      ).filter((hit) => !hit.startsWith("src/components/ui/styles.ts")),
    ).toEqual([]);
  });

  it("uses NumberStepper and Select instead of native number inputs and selects", () => {
    const outsideUi = (entry: (typeof FILES)[number]) => !entry.inUi;
    expect(offenders(/type=["']number["']/, outsideUi)).toEqual([]);
    expect(offenders(/<select(\s|>|$)/, outsideUi)).toEqual([]);
  });

  it("uses surface and ink tokens instead of raw zinc classes", () => {
    expect(
      offenders(
        /(^|[\s"'`:])[a-z-]+-zinc-\d{2,3}\b/,
        ({ file }) => file.endsWith(".tsx") || file.endsWith(".ts"),
      ),
    ).toEqual([]);
  });

  it("uses ArenaPanel (quiet) instead of the removed Panel component", () => {
    expect(offenders(/components\/ui\/Panel["']/)).toEqual([]);
    expect(
      offenders(/import \{[^}]*\bPanel\b[^}]*\} from "@\/components\/ui["']/),
    ).toEqual([]);
  });

  it("renders player overalls through OvrBadge, not raw OVR text", () => {
    // Staff ratings and scouted ranges are not known player overalls; team
    // averages ("Avg OVR") are aggregates, not a player badge.
    const allowed = /\/(staff|coaching|hiring|scouting)\/|Staff|Coaching/i;
    expect(
      offenders(
        /(?<!Avg )OVR \{/,
        ({ file, inUi }) =>
          file.endsWith(".tsx") && !inUi && !allowed.test(file),
      ),
    ).toEqual([]);
  });

  it("has one navigation model: no sidebar and no page-level sub-navs", () => {
    expect(offenders(/\bDesktopNavigation\b|\bNavGroups\b/)).toEqual([]);
    expect(offenders(/\b[A-Z]\w*SubNav\b/)).toEqual([]);
  });

  it("uses link tabs only in the hub sub-tab row; page views use ViewSwitch", () => {
    // A <Tabs>/<SlantTabs> whose items carry an href is navigation. Only the
    // shell's SubTabBar (and the dev showcase) may render that; switching
    // views of one page uses ViewSwitch, in-card tabs use onSelect.
    const allowed = /components\/(ui|game\/shell)\/|app\/dev\//;
    const hits = FILES.filter(
      ({ file }) => file.endsWith(".tsx") && !allowed.test(file),
    ).flatMap(({ file, text }) =>
      Array.from(text.matchAll(/<(Slant)?Tabs\b[\s\S]*?\/>/g))
        .filter((match) => /\bhref\s*:/.test(match[0]))
        .map(() => file),
    );
    expect(hits).toEqual([]);
  });

  it("renders headings through SectionHeading, not raw <h1-6 className>", () => {
    // SectionHeading defines the heading styles; the drawer's dialog title is
    // sized for its header; visually hidden headings carry no style.
    const allowed = /components\/ui\/(SectionHeading|Drawer)\.tsx$/;
    expect(
      offenders(
        /<h[1-3]\b[^>]*\bclassName=(?!"sr-only")/,
        ({ file }) => file.endsWith(".tsx") && !allowed.test(file),
      ),
    ).toEqual([]);
  });

  it("uses the type scale, not arbitrary pixel font sizes", () => {
    // Micro labels drawn inside a fixed-size box, where text-xs would
    // overflow it: portrait initials (xs), the 3-letter team chip, the
    // calendar "Next" tag and the identity editor's check dot.
    const allowed = new Set([
      "src/components/basketball/PlayerPortrait.tsx",
      "src/components/basketball/LeagueGameRow.tsx",
      "src/components/calendar/CalendarDayCell.tsx",
      "src/components/owner/ControlledFranchiseIdentityEditor.tsx",
    ]);
    expect(offenders(/\btext-\[1[01]px\]/)).toEqual([]);
    expect(
      offenders(/\btext-\[\d+px\]/, ({ file }) => !allowed.has(file)),
    ).toEqual([]);
  });

  it("takes status colours from the danger/success/caution/info tokens, not raw palette classes", () => {
    // Chart series colours and team logo art need literal palette values; the
    // milestone marker table lives in src/systems, which presentation-only
    // work does not edit.
    const allowed =
      /^src\/(components\/ui\/chart-theme\.ts|components\/team\/logos\/|data\/team-branding\/|app\/dev\/logo-showcase\/|systems\/calendar\/league-milestone-markers\.ts)/;
    expect(
      offenders(
        /(text|bg|border|ring|from|via|to|divide|fill|stroke|outline|decoration|shadow)-(rose|red|emerald|green|yellow|amber|sky|blue|orange|purple|pink)-\d/,
        ({ file }) => !allowed.test(file),
      ),
    ).toEqual([]);
  });

  it("keeps text-xs to table footnotes, axis ticks, timestamps and fixed-size boxes", () => {
    // Everything a player reads is text-sm (see ui/styles.ts). These files
    // hold the allowed uses: numeric counter badges, monograms and avatars,
    // glyph boxes, calendar and bracket cells, table footnotes, <time> tags.
    const allowed = new Set([
      "src/components/ui/SectionHeading.tsx",
      "src/components/ui/styles.ts",
      "src/components/ui/TeamBadge.tsx",
      "src/components/ui/KeyHint.tsx",
      "src/components/ui/InfoTip.tsx",
      "src/components/ui/DataTable.tsx",
      "src/components/team/TeamIdentityInline.tsx",
      "src/components/basketball/PlayerPortrait.tsx",
      "src/components/media-hub/timeline/AccountAvatar.tsx",
      "src/components/calendar/CalendarDayCell.tsx",
      "src/components/calendar/CalendarMonthView.tsx",
      "src/components/standings/StandingsTable.tsx",
      "src/components/playoffs/BracketTree.tsx",
      "src/components/game/GameHeader.tsx",
      "src/components/game/shell/NavBadge.tsx",
      "src/components/game/shell/MobileHubBar.tsx",
      "src/components/media-hub/MediaUnreadBadge.tsx",
      "src/components/owner/dashboard/HomeTileBoard.tsx",
      "src/components/owner/ai-management/ResponsibilityCard.tsx",
      "src/components/media-hub/stories/StorySlide.tsx",
      "src/components/media-hub/timeline/TopStoryHero.tsx",
      "src/components/media-hub/timeline/TimelinePostShell.tsx",
    ]);
    expect(offenders(/text-xs/, ({ file }) => !allowed.has(file))).toEqual([]);
  });
});
