import {
  numberedHubs,
  type OwnerHubId,
  type OwnerNavGroup,
} from "@/application/owner-nav-config";

/**
 * The hub a key press moves to: `q`/`e` step to the previous/next numbered
 * hub (wrapping), `1`–`9` jump. From Settings (unnumbered), `e` goes to the
 * first hub and `q` to the last. Undefined for any other key.
 */
export function hubForKey(
  key: string,
  groups: readonly OwnerNavGroup[],
  activeId: OwnerHubId | undefined,
): OwnerNavGroup | undefined {
  const hubs = numberedHubs(groups);
  if (hubs.length === 0) return undefined;
  const lower = key.toLowerCase();
  if (/^[1-9]$/.test(lower)) return hubs[Number(lower) - 1];
  if (lower !== "q" && lower !== "e") return undefined;
  const index = hubs.findIndex((hub) => hub.id === activeId);
  if (index === -1) return lower === "e" ? hubs[0] : hubs[hubs.length - 1];
  const step = lower === "e" ? 1 : -1;
  return hubs[(index + step + hubs.length) % hubs.length];
}

/** True when a key press belongs to a field or an open dialog, not the app. */
export function isTypingOrModal(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey)
    return true;
  const target = event.target;
  if (target instanceof HTMLElement) {
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  }
  return document.querySelector('[aria-modal="true"]') !== null;
}

/**
 * Where Esc goes from a path under the save: a tab returns to its hub's
 * landing, a hub landing returns to Home, Home stays. Undefined = no move.
 */
export function parentPathFor(
  groups: readonly OwnerNavGroup[],
  hubId: OwnerHubId | undefined,
  path: string,
): string | undefined {
  if (path === "") return undefined;
  const hub = groups.find((group) => group.id === hubId);
  if (!hub || path === hub.href) return "";
  return hub.href;
}

/** True when an open menu, listbox or disclosure should get Esc instead. */
export function hasOpenPopup(): boolean {
  return (
    document.querySelector(
      '[aria-expanded="true"], [role="menu"], [role="listbox"]',
    ) !== null
  );
}

/** True when nothing interactive has focus (Space would not press a control). */
export function isIdleFocus(): boolean {
  const active = document.activeElement;
  return (
    !active ||
    active === document.body ||
    active.tagName === "MAIN" ||
    active.getAttribute("tabindex") === "-1"
  );
}

/** Window event the command palette listens for. */
export const OPEN_COMMAND_PALETTE = "ballsim:command-palette";

/**
 * Where Sim goes (header button, Home hero, Space): the calendar's next-game
 * focus, which owns the confirm and blocking rules.
 */
export function simHref(saveId: string): string {
  return `/dashboard/${saveId}/calendar?focus=next-game`;
}
