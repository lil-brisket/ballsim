"use client";

import type { OwnerNavGroup } from "@/application/owner-nav-config";
import { NavBadge, badgeLabel } from "@/components/game/shell/NavBadge";
import { useActiveNav } from "@/components/game/shell/use-active-nav";
import { SlantTabs } from "@/components/ui/Tabs";

/**
 * The one sub-tab row: the active hub's tabs. Hidden for single-page hubs.
 * Pages do not render their own hub-level sub-navigation.
 */
export function SubTabBar(props: {
  saveId: string;
  groups: readonly OwnerNavGroup[];
  className?: string;
}) {
  const active = useActiveNav(props.saveId, props.groups);
  if (!active || active.hub.items.length < 2) return null;
  const base = `/dashboard/${props.saveId}`;
  return (
    <SlantTabs
      aria-label={`${active.hub.label} sections`}
      activeKey={active.item?.href ?? ""}
      className={props.className}
      items={active.hub.items.map((item) => ({
        key: item.href,
        label: item.label,
        href: `${base}${item.href}`,
        badge: item.badge ? (
          <>
            <NavBadge badge={item.badge} />
            <span className="sr-only">{badgeLabel(item.badge)}</span>
          </>
        ) : undefined,
      }))}
    />
  );
}
