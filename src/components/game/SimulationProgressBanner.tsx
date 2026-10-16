/**
 * Presentational progress banner for long-running Owner Mode simulation.
 * Server actions remain synchronous; this surfaces phase/day context when
 * callers stream progress (or after a completed advance).
 */

export type SimulationProgressBannerProps = {
  seasonYear: number;
  phase: string;
  currentDate: string;
  daysAdvanced?: number;
  daysRequested?: number;
  gamesSimulated?: number;
  percentComplete?: number;
  busy?: boolean;
};

export function SimulationProgressBanner(props: SimulationProgressBannerProps) {
  const percent =
    props.percentComplete != null
      ? Math.max(0, Math.min(100, Math.round(props.percentComplete)))
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-team-ink/50 bg-team/15 px-4 py-3 text-sm text-zinc-100"
    >
      <p className="font-medium text-zinc-50">
        {props.busy ? "Simulating" : "Last advance"} — Season {props.seasonYear}
      </p>
      <p className="mt-1 text-zinc-200">
        {props.phase} · {props.currentDate}
        {props.daysAdvanced != null && props.daysRequested != null
          ? ` · Day ${props.daysAdvanced} / ${props.daysRequested}`
          : null}
        {props.gamesSimulated != null
          ? ` · Games: ${props.gamesSimulated}`
          : null}
      </p>
      {percent != null ? (
        <div className="mt-2">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-team-ink transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-team-ink/80">{percent}% complete</p>
        </div>
      ) : null}
    </div>
  );
}
