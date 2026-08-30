import type { FantasyDraftView } from "@/state/selectors";

const LEVEL_STYLE = {
  HIGH: "text-red-300",
  MEDIUM: "text-amber-300",
  LOW: "text-zinc-400",
} as const;

export function TeamNeedsPanel(props: { draft: FantasyDraftView }) {
  return (
    <section className="rounded-xl border border-zinc-800 p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase text-zinc-400">
        Team needs
      </h2>
      <ul className="space-y-1.5 text-sm">
        {props.draft.teamNeeds.map((row) => (
          <li
            key={row.position}
            className="flex items-center justify-between gap-2"
          >
            <span className="font-mono text-zinc-300">{row.position}</span>
            <span className={`text-xs font-semibold ${LEVEL_STYLE[row.level]}`}>
              {row.level}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
