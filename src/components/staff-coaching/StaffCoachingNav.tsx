"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/staff", label: "Staff" },
  { href: "/coaching", label: "Coaching" },
] as const;

export function StaffCoachingNav(props: { saveId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/${props.saveId}/staff-coaching`;

  return (
    <nav
      className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3"
      aria-label="Staff and coaching"
    >
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tab.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
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
