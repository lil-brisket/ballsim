import type { SimulationPhaseContext } from "@/systems/simulation/simulation-phase";
import { formatGameDate } from "@/presentation/game-date";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StatusBadge } from "@/components/ui/StatusBadge";

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
      <SectionHeading
        eyebrow={`Season ${phase.seasonYear}`}
        title={phase.primaryLabel}
        action={
          phase.subLabel ? (
            <span className="text-sm text-zinc-400">{phase.subLabel}</span>
          ) : null
        }
      />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
        <span className="text-zinc-400">
          {formatGameDate(props.currentDate, { weekday: true })}
        </span>
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
                : "AI assist enabled"
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
