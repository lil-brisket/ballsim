"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  OWNER_NAV_GROUPS,
  type OwnerNavGroup,
} from "@/application/owner-nav-config";

function NavLink(props: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={props.href}
      onClick={props.onNavigate}
      aria-current={props.active ? "page" : undefined}
      className={`block rounded-md px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
        props.active
          ? "bg-amber-600/15 font-medium text-amber-400"
          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
      }`}
    >
      {props.label}
    </Link>
  );
}

function NavGroups(props: {
  saveId: string;
  unreadCount: number;
  onNavigate?: () => void;
  groups?: readonly OwnerNavGroup[];
}) {
  const pathname = usePathname();
  const base = `/dashboard/${props.saveId}`;
  const groups = props.groups ?? OWNER_NAV_GROUPS;

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="mb-1 px-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-600">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const href = `${base}${item.href}`;
              const active =
                item.href === ""
                  ? pathname === base
                  : pathname === href || pathname.startsWith(`${href}/`);
              const label =
                item.label === "Notifications" && props.unreadCount > 0
                  ? `Notifications (${props.unreadCount})`
                  : item.label;
              return (
                <li key={item.href || "dashboard"}>
                  <NavLink
                    href={href}
                    label={label}
                    active={active}
                    onNavigate={props.onNavigate}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Mode-provided navigation for Owner Mode.
 * Extends the former OwnerNav with grouped desktop sidebar + mobile drawer.
 */
export function GameNavigation(props: {
  saveId: string;
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          className="w-full rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-amber-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          aria-expanded={open}
          aria-controls="owner-mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Close menu" : "Menu"}
        </button>
        {open ? (
          <nav
            id="owner-mobile-nav"
            className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-3"
            aria-label="Owner Mode"
          >
            <NavGroups
              saveId={props.saveId}
              unreadCount={props.unreadCount}
              onNavigate={() => setOpen(false)}
            />
          </nav>
        ) : null}
      </div>

      <nav
        className="hidden w-52 shrink-0 lg:block"
        aria-label="Owner Mode"
      >
        <NavGroups saveId={props.saveId} unreadCount={props.unreadCount} />
      </nav>
    </>
  );
}
