import { formatGameDate } from "@/presentation/game-date";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { PhaseDashboardView } from "@/state/phase-dashboard";

export function PhaseHeader(props: {
  view: PhaseDashboardView;
  currentDate: string;
  seasonYear: number;
}) {
  const { view, currentDate, seasonYear } = props;
  const stage = view.resolved.stage.replaceAll("_", " ");

  return (
    <section
      className="rounded-xl border border-line-strong bg-surface-raised/60 px-4 py-4"
      aria-label="Current phase"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-team-ink">
        {stage} · {seasonYear} ·{" "}
        {formatGameDate(currentDate, { weekday: true })}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-sm text-muted">Now</p>
          <SectionHeading
            as="h2"
            size="sm"
            className="mt-0.5"
            titleClassName="text-lg!"
            title={view.nowLabel}
          />
          <p className="mt-1 text-sm text-success/90">{view.resolved.theme}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Next</p>
          <p className="mt-0.5 text-base text-ink">{view.nextLabel ?? "—"}</p>
          <p className="mt-1 text-sm text-faint">
            {view.showAdvanceControl
              ? "Begins when you advance"
              : "Advances with the league calendar"}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted">Later</p>
          <p className="mt-0.5 text-base text-ink">{view.laterLabel ?? "—"}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-soft">{view.resolved.objective}</p>
      {view.priorityLine ? (
        <p className="mt-2 text-sm text-ink">
          <span className="font-medium text-team-ink">Your priority:</span>{" "}
          {view.priorityLine}
        </p>
      ) : null}
    </section>
  );
}
