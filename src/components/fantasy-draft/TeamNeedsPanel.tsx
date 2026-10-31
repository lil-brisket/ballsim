import type { FantasyDraftView } from "@/state/selectors";
import { SectionHeading } from "@/components/ui/SectionHeading";

const LEVEL_STYLE = {
  HIGH: "text-danger-ink",
  MEDIUM: "text-warning",
  LOW: "text-muted",
} as const;

export function TeamNeedsPanel(props: { draft: FantasyDraftView }) {
  return (
    <section className="rounded-xl border border-line p-4">
      <SectionHeading title="Team needs" className="mb-2" />
      <ul className="space-y-1.5 text-sm">
        {props.draft.teamNeeds.map((row) => (
          <li
            key={row.position}
            className="flex items-center justify-between gap-2"
          >
            <span className="text-soft">{row.position}</span>
            <span className={`text-sm font-semibold ${LEVEL_STYLE[row.level]}`}>
              {row.level}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
