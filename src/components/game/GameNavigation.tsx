"use client";

import type { OwnerNavGroup } from "@/application/owner-nav-config";
import { DesktopNavigation } from "@/components/game/DesktopNavigation";
import { MobileNavigationDrawer } from "@/components/game/MobileNavigationDrawer";

/**
 * Owner Mode navigation shell.
 * Desktop sidebar and mobile overlay drawer share owner-nav-config data
 * but implement different UX.
 */
export function GameNavigation(props: {
  saveId: string;
  groups?: readonly OwnerNavGroup[];
}) {
  return (
    <>
      <MobileNavigationDrawer
        saveId={props.saveId}
        groups={props.groups}
      />
      <DesktopNavigation saveId={props.saveId} groups={props.groups} />
    </>
  );
}
