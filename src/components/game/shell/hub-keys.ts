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
