"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type {
  OwnerNavGroup,
  OwnerNavItem,
} from "@/application/owner-nav-config";
import { OWNER_NAV_GROUPS } from "@/application/owner-nav-config";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";

/**
 * Sidebar icons on one 24px grid, drawn at a single 1.75 stroke by NavIcon.
 * Home, team, league, awards and media paths are adapted from Lucide (ISC).
 */
export const NAV_ICONS: Record<string, React.ReactNode> = {
  home: (
    <>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  offseason: (
    <>
      <path d="M12 3v3M12 18v3M4.2 6.2l2.1 2.1M17.7 15.7l2.1 2.1M3 12h3M18 12h3M4.2 17.8l2.1-2.1M17.7 8.3l2.1-2.1" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  team: (
    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
  ),
  roster: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  lineups: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="9" y="14" width="6" height="6" rx="1" />
    </>
  ),
  staff: (
    <>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
    </>
  ),
  contracts: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </>
  ),
  development: (
    <>
      <path d="M12 20V10M7 15l5-5 5 5" />
      <path d="M5 20h14" />
    </>
  ),
  league: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20M2 12h20" />
      <path d="M4.93 4.93c3.9 3.9 3.9 10.24 0 14.14M19.07 4.93c-3.9 3.9-3.9 10.24 0 14.14" />
    </>
  ),
  standings: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M20 20H2" />
    </>
  ),
  schedule: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 11h8M8 15h5" />
    </>
  ),
  draft: <path d="M12 3l3 7h7l-5.5 4.5L18 22l-6-4-6 4 1.5-7.5L2 10h7z" />,
  scouting: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4-4" />
    </>
  ),
  freeAgency: (
    <>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </>
  ),
  transactions: <path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" />,
  awards: (
    <>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </>
  ),
  playoffs: (
    <>
      <path d="M6 4h12v4H6z" />
      <path d="M8 8v8M16 8v8M8 16h8" />
      <path d="M10 20h4" />
    </>
  ),
  media: (
    <>
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z" />
    </>
  ),
  finances: (
    <>
      <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  franchise: (
    <>
      <path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-6h6v6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
};

export function NavIcon(props: { name?: string; className?: string }) {
  const paths = props.name ? NAV_ICONS[props.name] : null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className ?? "h-4 w-4 shrink-0"}
      aria-hidden="true"
    >
      {paths ?? <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}

function NavBadge(props: { item: OwnerNavItem }) {
  const badge = props.item.badge;
  if (!badge || badge.count <= 0) return null;
  const kindClass =
    badge.kind === "critical"
      ? "bg-red-500 text-zinc-950"
      : badge.kind === "unread"
        ? "bg-zinc-600 text-zinc-100"
        : "bg-warning text-zinc-950";
  return (
    <span
      className={`ml-auto inline-flex min-w-[1.15rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums leading-4 ${kindClass}`}
    >
      {badge.count > 99 ? "99+" : badge.count}
    </span>
  );
}

function NavLink(props: {
  href: string;
  item: OwnerNavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { item, active, collapsed } = props;
  const badge = item.badge;
  const ariaLabel =
    badge && badge.count > 0
      ? `${item.label}, ${badge.count} ${badge.label}`
      : item.label;

  return (
    <Link
      href={props.href}
      onClick={props.onNavigate}
      title={collapsed ? ariaLabel : undefined}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed || badge ? ariaLabel : undefined}
      className={cn(
        touchTargetClass,
        "w-full justify-start gap-2 rounded-md px-3 text-sm",
        focusRingClass,
        active
          ? "nav-active font-semibold"
          : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
        collapsed && "justify-center px-2",
      )}
    >
      <NavIcon name={item.icon} className="h-5 w-5 shrink-0" />
      {!collapsed ? (
        <>
          <span className="min-w-0 truncate">{item.label}</span>
          <NavBadge item={item} />
        </>
      ) : badge && badge.count > 0 ? (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-team-ink" />
      ) : null}
    </Link>
  );
}

/** Shared nav group list — consumed by desktop sidebar and mobile drawer. */
export function NavGroups(props: {
  saveId: string;
  onNavigate?: () => void;
  groups?: readonly OwnerNavGroup[];
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const base = `/dashboard/${props.saveId}`;
  const groups = props.groups ?? OWNER_NAV_GROUPS;

  return (
    <div className="space-y-4">
      {groups.map((group, index) => {
        const seasonal = group.id === "offseason";
        // Single-item and unlabelled groups need no heading.
        const showLabel =
          group.label !== "" && (seasonal || group.items.length > 1);
        return (
          <div
            key={group.id}
            className={cn(
              seasonal &&
                !props.collapsed &&
                "rounded-lg border border-dashed border-surface-line bg-surface-deep/40 py-2",
            )}
          >
            {props.collapsed ? (
              index > 0 ? (
                <div
                  className="mb-1 border-t border-surface-line"
                  aria-hidden
                />
              ) : null
            ) : showLabel ? (
              <p
                className={cn(
                  "mb-1 px-3 text-sm font-medium",
                  seasonal ? "text-team-ink" : "text-team-ink/70",
                )}
              >
                {group.label}
                {seasonal ? " · Seasonal" : ""}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const href = `${base}${item.href}`;
                const active =
                  item.href === ""
                    ? pathname === base
                    : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={item.href || "dashboard"} className="relative">
                    <NavLink
                      href={href}
                      item={item}
                      active={active}
                      collapsed={props.collapsed}
                      onNavigate={props.onNavigate}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
