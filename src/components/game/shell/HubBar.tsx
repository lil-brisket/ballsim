"use client";

import Link from "next/link";
import {
  numberedHubs,
  type OwnerNavGroup,
} from "@/application/owner-nav-config";
import { NavBadge, badgeLabel } from "@/components/game/shell/NavBadge";
import { NavIcon } from "@/components/game/shell/NavIcon";
import { hubTransitionTypes } from "@/components/game/shell/transition-direction";
import { useActiveNav } from "@/components/game/shell/use-active-nav";
import { KeyHint } from "@/components/ui/KeyHint";
import {
  cn,
  displayClass,
  focusRingClass,
  slantClass,
  touchTargetClass,
} from "@/components/ui/styles";

/**
 * Desktop hub row: the numbered hubs as big display-font tabs (Q/E move,
 * 1–n jump; see HubKeys), Settings as an icon at the end.
 */
export function HubBar(props: {
  saveId: string;
  groups: readonly OwnerNavGroup[];
}) {
  const base = `/dashboard/${props.saveId}`;
  const active = useActiveNav(props.saveId, props.groups);
  const hubs = numberedHubs(props.groups);
  const settings = props.groups.find((group) => group.id === "settings");
  const settingsActive = active?.hub.id === "settings";
  // Slide direction follows the hub order; undefined = plain crossfade.
  const typesTo = (id: OwnerNavGroup["id"]) => {
    const types = hubTransitionTypes(props.groups, active?.hub.id, id);
    return types.length > 0 ? types : undefined;
  };

  return (
    <nav aria-label="Hubs" className="flex min-w-0 items-center gap-1">
      {/* Bar hints only on wide screens; the legend always lists Q/E. */}
      <span className="hidden 2xl:inline-flex">
        <KeyHint keys="Q" className="mr-1" />
      </span>
      <ul className="flex min-w-0 items-center gap-1">
        {hubs.map((hub) => {
          const isActive = active?.hub.id === hub.id;
          return (
            <li key={hub.id}>
              <Link
                href={`${base}${hub.href}`}
                transitionTypes={typesTo(hub.id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  displayClass,
                  slantClass,
                  "inline-flex min-h-11 items-center gap-2 whitespace-nowrap px-4 transition-colors",
                  isActive
                    ? "text-2xl text-on-team [--slant-fill:var(--team-primary)]"
                    : "text-lg text-muted hover:text-ink hover:[--slant-fill:var(--surface-high)]",
                  focusRingClass,
                )}
              >
                {hub.label}
                <NavBadge badge={hub.badge} />
                <span className="sr-only">{badgeLabel(hub.badge)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <span className="hidden 2xl:inline-flex">
        <KeyHint keys="E" className="ml-1" />
      </span>
      {settings ? (
        <Link
          href={`${base}${settings.href}`}
          transitionTypes={typesTo(settings.id)}
          aria-current={settingsActive ? "true" : undefined}
          className={cn(
            touchTargetClass,
            "ml-2 rounded-md",
            settingsActive ? "text-team-ink" : "text-muted hover:text-ink",
            focusRingClass,
          )}
        >
          <NavIcon name="settings" className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Link>
      ) : null}
    </nav>
  );
}
