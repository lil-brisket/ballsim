"use client";

import { usePathname } from "next/navigation";
import { ViewSwitch } from "@/components/ui/ViewSwitch";

const TABS = [
  { href: "/staff", label: "Staff" },
  { href: "/hiring-market", label: "Hiring Market" },
  { href: "/coaching", label: "Coaching" },
] as const;

export function StaffCoachingViews(props: { saveId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/${props.saveId}/staff-coaching`;

  return (
    <ViewSwitch
      aria-label="Staff and coaching"
      className="max-w-full flex-wrap"
      activeKey={
        TABS.find((tab) => {
          const href = `${base}${tab.href}`;
          return pathname === href || pathname.startsWith(`${href}/`);
        })?.href ?? ""
      }
      items={TABS.map((tab) => ({
        key: tab.href,
        label: tab.label,
        href: `${base}${tab.href}`,
      }))}
    />
  );
}
