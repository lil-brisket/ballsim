import type { PhaseDashboardView } from "@/state/phase-dashboard";

export function PhaseHeader(props: {
  view: PhaseDashboardView;
  currentDate: string;
  seasonYear: number;
}) {
  const { view, currentDate, seasonYear } = props;
  const stage = view.resolved.stage.replaceAll("_", " ").toUpperCase();

  return (
    <section
      className="rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-4"
      aria-label="Current phase"
    >
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-amber-500">
        {stage} · {seasonYear} · {currentDate}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Now
          </p>
          <h2 className="mt-0.5 text-lg font-medium text-zinc-50">
            {view.nowLabel}
          </h2>
          <p className="mt-1 text-sm text-emerald-400/90">{view.resolved.theme}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Next
          </p>
          <p className="mt-0.5 text-base text-zinc-200">
            {view.nextLabel ?? "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {view.showAdvanceControl
              ? "Begins when you advance"
              : "Advances with the league calendar"}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            Later
          </p>
          <p className="mt-0.5 text-base text-zinc-200">
            {view.laterLabel ?? "—"}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-zinc-300">{view.resolved.objective}</p>
      {view.priorityLine ? (
        <p className="mt-2 text-sm text-amber-200/90">
          <span className="font-medium text-amber-400">Your priority:</span>{" "}
          {view.priorityLine}
        </p>
      ) : null}
    </section>
  );
}
