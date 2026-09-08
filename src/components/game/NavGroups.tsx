"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OwnerNavGroup, OwnerNavItem } from "@/application/owner-nav-config";
import { OWNER_NAV_GROUPS } from "@/application/owner-nav-config";
import { cn, focusRingClass } from "@/components/ui/styles";

export const NAV_ICONS: Record<string, React.ReactNode> = {
  home: (
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" />
  ),
  teams: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M3 19c0-2.5 2.5-4 6-4s6 1.5 6 4" />
      <path d="M14 19c0-1.8 1.5-3 4-3s3.5 1 3.5 3" />
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
  team: <circle cx="12" cy="12" r="8" />,
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
  league: <circle cx="12" cy="12" r="9" />,
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
  awards: <path d="M8 4h8v4a4 4 0 0 1-8 0V4zM9 21h6M12 12v9" />,
  media: (
    <>
      <path d="M4 6h16v12H4z" />
      <path d="m8 10 4 3 4-3" />
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
        : "bg-amber-500 text-zinc-950";
  return (
    <span
      className={`ml-auto inline-flex min-w-[1.15rem] items-center justify-center rounded-full px-1.5 font-mono text-[0.65rem] font-semibold leading-4 ${kindClass}`}
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
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
        focusRingClass,
        active
          ? "border-l-2 border-amber-500 bg-amber-600/15 font-medium text-amber-400"
          : "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200",
        collapsed && "justify-center px-2",
      )}
    >
      <NavIcon name={item.icon} />
      {!collapsed ? (
        <>
          <span className="min-w-0 truncate">{item.label}</span>
          <NavBadge item={item} />
        </>
      ) : badge && badge.count > 0 ? (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
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
    <div className="space-y-5">
      {groups.map((group) => {
        const seasonal = group.id === "offseason";
        return (
          <div
            key={group.id}
            className={cn(
              seasonal &&
                !props.collapsed &&
                "rounded-lg border border-dashed border-zinc-700/80 bg-zinc-950/40 py-2",
            )}
          >
            {!props.collapsed ? (
              <p
                className={cn(
                  "mb-1 px-3 font-mono text-[0.65rem] uppercase tracking-[0.16em]",
                  seasonal ? "text-amber-700/80" : "text-zinc-600",
                )}
              >
                {group.label}
                {seasonal ? " · Seasonal" : ""}
              </p>
            ) : (
              <div className="mb-1 border-t border-zinc-800/80" aria-hidden />
            )}
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
