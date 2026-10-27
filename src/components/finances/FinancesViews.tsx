import { ViewSwitch } from "@/components/ui/ViewSwitch";

/**
 * Views of the Finances section (Issue #189). Facilities live at
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

export type FinancesViewKey = (typeof LINKS)[number]["key"];

export function FinancesViews(props: {
  saveId: string;
  active: FinancesViewKey;
}) {
  const base = `/dashboard/${props.saveId}`;
  return (
    <ViewSwitch
      aria-label="Finances"
      className="mb-6 max-w-full flex-wrap"
      activeKey={props.active}
      items={LINKS.map((link) => ({
        key: link.key,
        label: link.label,
        href: `${base}${link.suffix}`,
      }))}
    />
  );
}
