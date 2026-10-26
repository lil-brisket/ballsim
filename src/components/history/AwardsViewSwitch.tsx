import { ViewSwitch } from "@/components/ui/ViewSwitch";

/** Awards tab views: the season's awards and the fan vote. */
export function AwardsViewSwitch(props: {
  saveId: string;
  active: "awards" | "fan-voting";
  className?: string;
}) {
  const base = `/dashboard/${props.saveId}`;
  return (
    <ViewSwitch
      aria-label="Awards view"
      activeKey={props.active}
      className={props.className}
      items={[
        { key: "awards", label: "Season awards", href: `${base}/awards` },
        {
          key: "fan-voting",
          label: "Fan voting",
          href: `${base}/season-events/fan-voting`,
        },
      ]}
    />
  );
}
