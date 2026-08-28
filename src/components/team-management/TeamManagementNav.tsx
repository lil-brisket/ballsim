"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/lineups", label: "Lineups" },
  { href: "/rotations", label: "Rotations" },
  { href: "/coaching", label: "Coaching" },
  { href: "/injuries", label: "Injuries" },
  { href: "/transactions", label: "Transactions" },
] as const;

export function TeamManagementNav(props: { saveId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/${props.saveId}/team-management`;

  return (
    <nav className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const active =
          tab.href === ""
            ? pathname === base || pathname === `${base}/`
            : pathname.startsWith(href);
        return (
          <Link
            key={tab.href || "overview"}
            href={href}
            className={`rounded-full border px-3 py-1 text-xs ${
              active
                ? "border-amber-600 text-amber-400"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
