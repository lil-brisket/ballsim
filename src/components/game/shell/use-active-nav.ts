"use client";

import { usePathname } from "next/navigation";
import {
  activeOwnerNav,
  type ActiveOwnerNav,
  type OwnerNavGroup,
} from "@/application/owner-nav-config";

/** Active hub and tab for the current URL inside a save. */
export function useActiveNav(
  saveId: string,
  groups: readonly OwnerNavGroup[],
): ActiveOwnerNav | undefined {
  const pathname = usePathname() ?? "";
  const base = `/dashboard/${saveId}`;
  const path = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  return activeOwnerNav(groups, path);
}
