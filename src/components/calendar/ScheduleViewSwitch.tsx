import { ViewSwitch } from "@/components/ui/ViewSwitch";

/** Schedule is one tab with two views: the sim calendar and the game list. */
export function ScheduleViewSwitch(props: {
  saveId: string;
  active: "calendar" | "list";
}) {
  const base = `/dashboard/${props.saveId}`;
  return (
    <ViewSwitch
      aria-label="Schedule view"
      activeKey={props.active}
      items={[
        { key: "calendar", label: "Calendar", href: `${base}/calendar` },
        { key: "list", label: "List", href: `${base}/schedule` },
      ]}
    />
  );
}
