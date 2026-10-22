import { cn } from "@/components/ui/styles";

type StatTone = "win" | "loss";

/** Compact lower-third stat block: big numbers grouped left, muted extras below. */
export function StatLine(props: {
  /** One to three headline stats. */
  primary: Array<{ label: string; value: string; tone?: StatTone }>;
  secondary?: Array<{ label: string; value: string }>;
  size?: "md" | "lg";
}) {
  const valueSize = props.size === "lg" ? "text-5xl" : "text-3xl";
  return (
    <div className="space-y-2">
      <dl className="flex gap-6">
        {props.primary.map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse">
            <dt className="text-sm text-zinc-400">{stat.label}</dt>
            <dd
              className={cn(
                "font-display font-extrabold tabular-nums",
                valueSize,
                stat.tone === "win"
                  ? "text-win"
                  : stat.tone === "loss"
                    ? "text-loss"
                    : "text-zinc-50",
              )}
            >
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      {props.secondary && props.secondary.length > 0 ? (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {props.secondary.map((stat) => (
            <div key={stat.label} className="flex gap-1.5">
              <dt className="text-zinc-400">{stat.label}</dt>
              <dd className="tabular-nums text-zinc-200">{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
