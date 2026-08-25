import {
  AI_MANAGEMENT_PRESET_LABELS,
  MANAGEMENT_PHASE_LABELS,
  type AiAssistancePhases,
  type AiManagementPreset,
  type ManagementPhase,
} from "@/domain/ai-management-presets";
import { resolveAssistancePhases } from "@/domain/ai-management-presets";

export type SimulationAssistantSummaryProps = {
  preset: AiManagementPreset;
  assistance: AiAssistancePhases;
  compact?: boolean;
};

const WILL_HANDLE_PHASES: ManagementPhase[] = [
  "injuriesEmergencyRoster",
  "rotationsDepthChart",
  "freeAgency",
  "waiversReleases",
  "coachingStaff",
  "frontOfficeStaff",
];

const WILL_NOT_PHASES: ManagementPhase[] = [
  "trades",
  "draftSelection",
  "contracts",
  "strategicRosterDecisions",
  "longTermPlanning",
];

function modeAllows(
  mode: string,
): "off" | "assist" | "recommend" {
  if (mode === "off") {
    return "off";
  }
  if (mode === "recommend" || mode === "user_only") {
    return "recommend";
  }
  return "assist";
}

/**
 * Pre-simulation summary of what AI will / will not do under the current preset.
 */
export function SimulationAssistantSummary({
  preset,
  assistance,
  compact = false,
}: SimulationAssistantSummaryProps) {
  const phases = resolveAssistancePhases(preset, assistance);
  const will = WILL_HANDLE_PHASES.filter(
    (phase) => modeAllows(phases[phase]) === "assist",
  );
  const willNot = WILL_NOT_PHASES.filter(
    (phase) => modeAllows(phases[phase]) === "off",
  );
  const recommend = (Object.keys(phases) as ManagementPhase[]).filter(
    (phase) => modeAllows(phases[phase]) === "recommend",
  );

  if (preset === "off") {
    return (
      <div className="rounded-md border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
        <p className="font-medium text-zinc-100">Simulation Assistance — Off</p>
        <p className="mt-1 text-zinc-400">
          You handle all franchise decisions during simulation.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
      <p className="font-medium text-zinc-100">
        Simulation Assistance — {AI_MANAGEMENT_PRESET_LABELS[preset].split(" — ")[0]}
      </p>
      {!compact ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              AI will
            </p>
            <ul className="mt-1 list-inside list-disc text-zinc-400">
              {will.length === 0 ? (
                <li>Nothing (restricted)</li>
              ) : (
                will.map((phase) => (
                  <li key={phase}>{MANAGEMENT_PHASE_LABELS[phase]}</li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              AI will not
            </p>
            <ul className="mt-1 list-inside list-disc text-zinc-400">
              {willNot.length === 0 ? (
                <li>Most decisions enabled</li>
              ) : (
                willNot.map((phase) => (
                  <li key={phase}>{MANAGEMENT_PHASE_LABELS[phase]}</li>
                ))
              )}
              {recommend.map((phase) => (
                <li key={`rec-${phase}`}>
                  {MANAGEMENT_PHASE_LABELS[phase]} (recommend only)
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-zinc-400">
          {will.length} phase{will.length === 1 ? "" : "s"} assisted ·{" "}
          {willNot.length} restricted
        </p>
      )}
    </div>
  );
}
