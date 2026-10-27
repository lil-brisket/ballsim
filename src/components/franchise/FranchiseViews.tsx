import { ViewSwitch } from "@/components/ui/ViewSwitch";

/**
 * Views of the Franchise section (Issue #190). Relocation lives
 * at `/franchise/relocation`; the old `/relocation` route redirects there.
 */
const LINKS = [
  { key: "overview", suffix: "/franchise", label: "Overview" },
  { key: "ownership", suffix: "/franchise/ownership", label: "Ownership" },
  { key: "history", suffix: "/franchise/history", label: "History" },
  { key: "relocation", suffix: "/franchise/relocation", label: "Relocation" },
] as const;

export type FranchiseViewKey = (typeof LINKS)[number]["key"];

export function FranchiseViews(props: {
  saveId: string;
  active: FranchiseViewKey;
}) {
  const base = `/dashboard/${props.saveId}`;
  return (
    <ViewSwitch
      aria-label="Franchise"
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
