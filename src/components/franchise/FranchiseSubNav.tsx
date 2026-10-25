import { Tabs } from "@/components/ui/Tabs";

/**
 * Sub-navigation for the Franchise section (Issue #190). Relocation lives
 * at `/franchise/relocation`; the old `/relocation` route redirects there.
 */
const LINKS = [
  { key: "overview", suffix: "/franchise", label: "Overview" },
  { key: "history", suffix: "/franchise/history", label: "History" },
  { key: "relocation", suffix: "/franchise/relocation", label: "Relocation" },
] as const;

export type FranchiseSubNavKey = (typeof LINKS)[number]["key"];

export function FranchiseSubNav(props: {
  saveId: string;
  active: FranchiseSubNavKey;
}) {
  const base = `/dashboard/${props.saveId}`;
  return (
    <Tabs
      aria-label="Franchise"
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
