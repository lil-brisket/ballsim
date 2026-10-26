"use client";

import { useState } from "react";
import Link from "next/link";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import { NavBadge, badgeLabel } from "@/components/game/shell/NavBadge";
import { NavIcon } from "@/components/game/shell/NavIcon";
import { useActiveNav } from "@/components/game/shell/use-active-nav";
import { Drawer } from "@/components/ui/Drawer";
import { cn, focusRingClass, linkClass } from "@/components/ui/styles";

const PINNED = ["home", "team", "league", "front-office"] as const;

/**
 * Phone hub bar, fixed to the bottom: four pinned hubs, then Offseason (in
 * the offseason) or Media, then More for the rest.
 */
export function MobileHubBar(props: {
  saveId: string;
  groups: readonly OwnerNavGroup[];
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const base = `/dashboard/${props.saveId}`;
  const active = useActiveNav(props.saveId, props.groups);
  const byId = new Map(props.groups.map((group) => [group.id, group]));
  const fifth = byId.get("offseason") ?? byId.get("media");
  const bar = [...PINNED.map((id) => byId.get(id)), fifth].filter(
    (hub): hub is OwnerNavGroup => hub !== undefined,
  );
  const more = props.groups.filter((group) => !bar.includes(group));
  const moreActive = more.some((group) => group.id === active?.hub.id);
  const moreBadge = more.find((group) => group.badge)?.badge;

  const itemClass = (isActive: boolean) =>
    cn(
      "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold touch-manipulation",
      isActive ? "text-team-ink" : "text-muted",
      focusRingClass,
    );

  return (
    <>
      <nav
        aria-label="Hubs"
        className="safe-area-bottom fixed inset-x-0 bottom-0 z-40 border-t border-surface-line bg-surface-deep/95 backdrop-blur lg:hidden"
      >
        <ul className="flex">
          {bar.map((hub) => {
            const isActive = active?.hub.id === hub.id;
            return (
              <li key={hub.id} className="flex flex-1">
                <Link
                  href={`${base}${hub.href}`}
                  aria-current={isActive ? "true" : undefined}
                  className={itemClass(isActive)}
                >
                  <NavIcon name={hub.icon} className="h-5 w-5" />
                  {hub.id === "front-office" ? "Office" : hub.label}
                  <span className="sr-only">{badgeLabel(hub.badge)}</span>
                  <NavBadge
                    badge={hub.badge}
                    className="absolute right-1/2 top-1.5 translate-x-5"
                  />
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={itemClass(moreActive)}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="5" cy="12" r="1.75" />
                <circle cx="12" cy="12" r="1.75" />
                <circle cx="19" cy="12" r="1.75" />
              </svg>
              More
              <span className="sr-only">{badgeLabel(moreBadge)}</span>
              <NavBadge
                badge={moreBadge}
                className="absolute right-1/2 top-1.5 translate-x-5"
              />
            </button>
          </li>
        </ul>
      </nav>
      <Drawer open={moreOpen} onOpenChange={setMoreOpen} title="More" size="sm">
        <ul className="space-y-1">
          {more.map((hub) => (
            <li key={hub.id}>
              <Link
                href={`${base}${hub.href}`}
                onClick={() => setMoreOpen(false)}
                aria-current={active?.hub.id === hub.id ? "true" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-base",
                  active?.hub.id === hub.id
                    ? "bg-surface-high text-ink"
                    : "text-soft hover:bg-surface-high",
                  focusRingClass,
                )}
              >
                <NavIcon name={hub.icon} className="h-5 w-5" />
                {hub.label}
                <span className="sr-only">{badgeLabel(hub.badge)}</span>
                <NavBadge badge={hub.badge} className="ml-auto" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-6 border-t border-surface-line pt-4 text-sm">
          <Link href="/home" className={cn(linkClass, focusRingClass)}>
            Back to BallSim home
          </Link>
        </p>
      </Drawer>
    </>
  );
}
