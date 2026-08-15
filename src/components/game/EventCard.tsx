import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { StatusBadge } from "@/components/owner/StatusBadge";

export function EventCard(props: {
  title: string;
  description?: string;
  date?: string;
  type?: string;
  severity?: string;
  amount?: number | null;
  read?: boolean;
}) {
  const important =
    props.severity === "warning" || props.severity === "critical";

  return (
    <li
      className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
        important
          ? "border-amber-800/60 bg-amber-950/20"
          : "border-zinc-800 bg-zinc-900/40"
      } ${props.read === false ? "ring-1 ring-amber-700/30" : ""}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-zinc-100">{props.title}</p>
          {props.severity ? (
            <StatusBadge label={props.severity} tone={props.severity} />
          ) : null}
        </div>
        {props.description ? (
          <p className="mt-1 text-zinc-400">{props.description}</p>
        ) : null}
        <p className="mt-1 font-mono text-xs text-zinc-600">
          {[props.date, props.type].filter(Boolean).join(" · ")}
        </p>
      </div>
      {props.amount != null ? (
        <MoneyDisplay amount={props.amount} className="shrink-0 text-zinc-400" />
      ) : null}
    </li>
  );
}
