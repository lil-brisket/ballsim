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
      className="rounded-lg border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100"
    >
      <p className="font-medium text-amber-50">
        {props.busy ? "Simulating" : "Last advance"} — Season {props.seasonYear}
      </p>
      <p className="mt-1 text-amber-200/90">
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
              className="h-full rounded-full bg-amber-500 transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-amber-300/80">{percent}% complete</p>
        </div>
      ) : null}
    </div>
  );
}
