import {
  activeOwnerNav,
  OWNER_NAV_GROUPS,
} from "@/application/owner-nav-config";

const SAVE_PATH = /^\/dashboard\/([^/]+)(\/.*)?$/;

/**
 * Resolves "Back to <Hub>" for a pathname inside a save; falls back to the
 * save's Home.
 */
export function backTarget(pathname: string): { href: string; label: string } {
  const match = SAVE_PATH.exec(pathname);
  if (!match) return { href: "/home", label: "Back to Home" };
  const base = `/dashboard/${match[1]}`;
  const hub = activeOwnerNav(OWNER_NAV_GROUPS, match[2] ?? "")?.hub;
  if (!hub) return { href: base, label: "Back to Home" };
  return { href: `${base}${hub.href}`, label: `Back to ${hub.label}` };
}
