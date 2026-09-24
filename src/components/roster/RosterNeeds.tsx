import type { RosterNeed, RosterNeedLevel } from "@/state/roster-page-selectors";
import { cn, panelClass } from "@/components/ui/styles";

const LEVEL_TONE: Record<RosterNeedLevel, string> = {
  strong: "text-emerald-400",
  adequate: "text-zinc-300",
  weak: "text-amber-400",
  critical: "text-rose-400",
};

const LEVEL_LABEL: Record<RosterNeedLevel, string> = {
  strong: "Strong",
  adequate: "Adequate",
  weak: "Weak",
  critical: "Critical",
};

export function RosterNeeds(props: { needs: RosterNeed[] }) {
  if (props.needs.length === 0) {
    return null;
  }

  return (
    <section
      className={cn(panelClass, "px-4 py-3")}
      aria-label="Roster needs"
    >
      <h2 className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
        Roster Needs
      </h2>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {props.needs.map((need) => (
          <li key={need.position} className="min-w-[5.5rem]" title={need.explanation}>
            <span className="font-mono text-sm text-amber-400">{need.position}</span>
            <span
              className={cn(
                "ml-2 text-sm font-medium",
                LEVEL_TONE[need.level],
              )}
            >
              {LEVEL_LABEL[need.level]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
