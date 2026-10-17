import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { cn, type Density } from "@/components/ui/styles";

/**
 * Metric surface for page-level stats: sentence-case label over a large
 * scoreboard value. Do not nest StatCards inside Panel.
 */
export function StatCard(props: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  density?: Density;
  className?: string;
}) {
  return (
    <ArenaPanel
      as="div"
      raised
      density={props.density ?? "comfortable"}
      className={props.className}
    >
      <h2 className="text-sm font-medium text-zinc-400">
        {props.label}
      </h2>
      <div
        className={cn(
          "mt-2 text-zinc-50",
          props.mono
            ? "font-mono text-xl"
            : "font-display text-3xl font-bold tabular-nums",
        )}
      >
        {props.value}
      </div>
    </ArenaPanel>
  );
}
