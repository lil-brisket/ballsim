/**
 * Checks that fail today, keyed by `<project> <route>` (smoke) or
 * `<project> a11y <route>`. Each is marked as an expected failure, so the
 * suite stays green while the issue exists and goes red once it is fixed
 * (then delete the entry).
 */

const SIDEBAR_BADGE_NAME =
  "label-content-name-mismatch: sidebar links with a badge are named " +
  '"Media Hub, 19 unread" but show "Media Hub 19" (sidebar removed in Console UI Phase 3)';
const SUMMARY_STRIP_SCROLL =
  "scrollable-region-focusable: horizontally scrolling summary strip is not keyboard reachable";
const MEDIA_FEED =
  "aria-required-children: role=feed without article children; color-contrast on a post-game card";

export const KNOWN_ISSUES: Readonly<Record<string, string>> = {
  "desktop a11y /": SIDEBAR_BADGE_NAME,
  "desktop a11y /roster": SIDEBAR_BADGE_NAME,
  "desktop a11y /league": SIDEBAR_BADGE_NAME,
  "desktop a11y /finances": SIDEBAR_BADGE_NAME,
  "desktop a11y /draft": SIDEBAR_BADGE_NAME,
  "desktop a11y /media": `${SIDEBAR_BADGE_NAME}; ${MEDIA_FEED}`,
  "mobile a11y /roster": `${SUMMARY_STRIP_SCROLL} (Roster summary)`,
  "mobile a11y /draft": `${SUMMARY_STRIP_SCROLL} (Draft summary)`,
  "mobile a11y /finances": SUMMARY_STRIP_SCROLL,
  "mobile a11y /media": MEDIA_FEED,
};
