import type {
  RosterNeed,
  RosterNeedLevel,
} from "@/state/roster-page-selectors";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn, panelClass } from "@/components/ui/styles";

const LEVEL_TONE: Record<RosterNeedLevel, string> = {
  strong: "text-success",
  adequate: "text-soft",
  weak: "text-warning",
  critical: "text-danger",
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
    <section className={cn(panelClass, "px-4 py-3")} aria-label="Roster needs">
      <SectionHeading title="Roster Needs" />
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {props.needs.map((need) => (
          <li
            key={need.position}
            className="min-w-[5.5rem]"
            title={need.explanation}
          >
            <span className="text-sm font-semibold text-team-ink">
              {need.position}
            </span>
            <span
              className={cn("ml-2 text-sm font-medium", LEVEL_TONE[need.level])}
            >
              {LEVEL_LABEL[need.level]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
