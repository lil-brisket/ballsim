"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui/Tabs";

const TABS = [
  { href: "/staff", label: "Staff" },
  { href: "/hiring-market", label: "Hiring Market" },
  { href: "/coaching", label: "Coaching" },
] as const;

export function StaffCoachingNav(props: { saveId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/${props.saveId}/staff-coaching`;

  return (
    <Tabs
      aria-label="Staff and coaching"
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
