import { StatusBadge } from "@/components/ui/StatusBadge";
import type { OffseasonStatusItem } from "@/state/offseason-hub-selectors";

export function OffseasonStatusChecklist(props: {
  items: readonly OffseasonStatusItem[];
}) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {props.items.map((item) => (
        <li
          key={item.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800 px-3 py-2.5"
        >
          <div>
            <p className="text-sm font-medium text-zinc-100">{item.label}</p>
            <p className="text-xs text-zinc-500">{item.detail}</p>
          </div>
          <StatusBadge
            label={item.done ? "Set" : "Open"}
            tone={item.done ? "completed" : "warning"}
          />
        </li>
      ))}
    </ul>
  );
}
