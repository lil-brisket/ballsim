import type { SimulationPhaseContext } from "@/systems/simulation/simulation-phase";
import { StatusBadge } from "@/components/owner/StatusBadge";

/**
 * Prominent phase status for Owner Mode. Presentation only.
 */
export function SimulationPhaseBanner(props: {
  phase: SimulationPhaseContext;
  currentDate: string;
}) {
  const { phase } = props;
  const dayLabel =
    phase.phaseDurationDays !== null
      ? `Day ${phase.dayInPhase} / ${phase.phaseDurationDays}`
      : `Day ${phase.dayInPhase}`;

  const responsibilityTone =
    phase.responsibility === "unresolved"
      ? "warning"
      : phase.responsibility === "ai"
        ? "info"
        : "neutral";

  return (
    <section
      className="rounded-xl border border-zinc-700 bg-zinc-900/70 px-4 py-4"
      aria-label="Simulation phase"
    >
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-500">
        Season {phase.seasonYear}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <h2 className="text-xl font-semibold uppercase tracking-wide text-zinc-50">
          {phase.primaryLabel}
        </h2>
        {phase.subLabel ? (
          <span className="text-sm text-zinc-400">{phase.subLabel}</span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
        <span className="font-mono text-zinc-400">{props.currentDate}</span>
        <span>·</span>
        <span>{dayLabel}</span>
        {phase.nextPhaseLabel ? (
          <>
            <span>·</span>
            <span>Next: {phase.nextPhaseLabel}</span>
          </>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {phase.unresolvedDecisionCount > 0 ? (
          <StatusBadge
            label={`${phase.unresolvedDecisionCount} unresolved decision${phase.unresolvedDecisionCount === 1 ? "" : "s"}`}
            tone="warning"
          />
        ) : (
          <StatusBadge label="No unresolved decisions" tone="success" />
        )}
        {phase.aiAssistEnabled ? (
          <StatusBadge
            label={
              phase.responsibility === "ai"
                ? "AI managing"
                : "Smart Assist enabled"
            }
            tone="info"
          />
        ) : (
          <StatusBadge label="AI assist off" tone="neutral" />
        )}
        <StatusBadge
          label={`Owner: ${phase.responsibility}`}
          tone={responsibilityTone}
        />
      </div>
    </section>
  );
}
