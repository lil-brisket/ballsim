"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "", label: "Dashboard" },
  { href: "/roster", label: "Roster" },
  { href: "/contracts", label: "Contracts" },
  { href: "/staff", label: "Staff" },
  { href: "/facilities", label: "Facilities" },
  { href: "/business", label: "Business" },
  { href: "/sponsorships", label: "Sponsorships" },
  { href: "/league", label: "League" },
  { href: "/relocation", label: "Relocation" },
  { href: "/history", label: "History" },
  { href: "/transactions", label: "Transactions" },
  { href: "/free-agency", label: "Free Agency" },
  { href: "/draft", label: "Draft" },
  { href: "/finances", label: "Finances" },
  { href: "/standings", label: "Standings" },
  { href: "/schedule", label: "Schedule" },
  { href: "/notifications", label: "Notifications" },
] as const;

export function OwnerNav(props: {
  saveId: string;
  unreadCount: number;
}) {
  const pathname = usePathname();
  const base = `/dashboard/${props.saveId}`;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-zinc-800 pb-px">
      {NAV_ITEMS.map((item) => {
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
          <Link
            key={item.href || "dashboard"}
            href={href}
            className={`whitespace-nowrap rounded-t-md px-3 py-2 text-sm ${
              active
                ? "border-b-2 border-amber-500 font-medium text-amber-400"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
