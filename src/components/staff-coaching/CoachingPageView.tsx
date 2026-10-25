import { applyCoachingPresetAction } from "@/application/actions";
import { CoachingPhilosophyForm } from "@/components/staff-coaching/CoachingPhilosophyForm";
import { presetSummary } from "@/components/staff-coaching/coaching-copy";
import { ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { CoachingView } from "@/state/team-management-selectors";

export function CoachingPageView(props: {
  saveId: string;
  coaching: CoachingView;
  returnPath: string;
  error?: string;
}) {
  const { saveId, coaching, returnPath, error } = props;

  return (
    <>
      <PageHeader
        title="Coaching"
        actions={
          coaching.activePreset === "custom" ? (
            <StatusBadge label="Customized" tone="warning" />
          ) : (
            <StatusBadge
              label={
                coaching.presets.find(
                  (preset) => preset.id === coaching.activePreset,
                )?.label ?? coaching.activePreset
              }
              tone="success"
            />
          )
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <Section title="Presets">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {coaching.presets.map((preset) => {
            const active = coaching.activePreset === preset.id;
            return (
              <form key={preset.id} action={applyCoachingPresetAction}>
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="teamId" value={coaching.teamId} />
                <input type="hidden" name="presetId" value={preset.id} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <button
                  type="submit"
                  aria-pressed={active}
                  className={`flex h-full w-full flex-col items-start gap-1 rounded-lg border bg-zinc-950/40 px-4 py-3 text-left transition hover:border-zinc-500 ${
                    active ? "border-team-ink" : "border-zinc-800"
                  }`}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="font-medium text-zinc-100">
                      {preset.label}
                    </span>
                    {active ? (
                      <StatusBadge label="Active" tone="success" />
                    ) : null}
                  </span>
                  <span className="text-sm text-zinc-400">
                    {preset.description}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {presetSummary(preset)}
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      </Section>

      <Section title="Philosophy">
        <CoachingPhilosophyForm
          saveId={saveId}
          returnPath={returnPath}
          coaching={coaching}
        />
      </Section>
    </>
  );
}
