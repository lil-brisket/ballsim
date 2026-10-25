import { Tabs } from "@/components/ui/Tabs";

/**
 * Sub-navigation for the Finances section (Issue #189). Facilities live at
 * `/finances/facilities`; the old `/facilities` route redirects there.
 */
const LINKS = [
  { key: "overview", suffix: "/finances", label: "Overview" },
  { key: "payroll", suffix: "/finances/payroll", label: "Payroll" },
  { key: "activity", suffix: "/finances/activity", label: "Activity" },
  {
    key: "facilities",
    suffix: "/finances/facilities",
    label: "Arena & Facilities",
  },
] as const;

export type FinancesSubNavKey = (typeof LINKS)[number]["key"];

export function FinancesSubNav(props: {
  saveId: string;
  active: FinancesSubNavKey;
}) {
  const base = `/dashboard/${props.saveId}`;
  return (
    <Tabs
      aria-label="Finances"
      className="mb-6"
      activeKey={props.active}
      items={LINKS.map((link) => ({
        key: link.key,
        label: link.label,
        href: `${base}${link.suffix}`,
      }))}
    />
  );
}
