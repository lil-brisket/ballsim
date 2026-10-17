import { buttonClass } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  applyCoachingPresetAction,
  updateCoachingPhilosophyAction,
} from "@/application/actions";
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
            <StatusBadge label={coaching.activePreset} tone="success" />
          )
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <Section title="Presets">
        <div className="flex flex-wrap gap-2">
          {coaching.presets.map((preset) => (
            <form key={preset.id} action={applyCoachingPresetAction}>
              <input type="hidden" name="saveId" value={saveId} />
              <input type="hidden" name="teamId" value={coaching.teamId} />
              <input type="hidden" name="presetId" value={preset.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <button
                type="submit"
                title={preset.description}
                className={buttonClass({
                  variant:
                    coaching.activePreset === preset.id ? "secondary" : "quiet",
                })}
              >
                {preset.label}
              </button>
            </form>
          ))}
        </div>
      </Section>

      <Section title="Philosophy">
        <form
          action={updateCoachingPhilosophyAction}
          className="grid gap-4 sm:grid-cols-3"
        >
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="teamId" value={coaching.teamId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            Pace
            <Select
              name="pace"
              defaultValue={coaching.philosophy.pace}
              wrapperClassName="w-full"
            >
              <option value="fast">Fast</option>
              <option value="balanced">Balanced</option>
              <option value="halfCourt">Half court</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            Offensive emphasis
            <Select
              name="offensiveEmphasis"
              defaultValue={coaching.philosophy.offensiveEmphasis}
              wrapperClassName="w-full"
            >
              <option value="threePointHeavy">Three-point heavy</option>
              <option value="balanced">Balanced</option>
              <option value="inside">Inside</option>
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-zinc-500">
            Defensive approach
            <Select
              name="defensiveApproach"
              defaultValue={coaching.philosophy.defensiveApproach}
              wrapperClassName="w-full"
            >
              <option value="aggressive">Aggressive</option>
              <option value="balanced">Balanced</option>
              <option value="conservative">Conservative</option>
            </Select>
          </label>
          <div className="sm:col-span-3">
            <p className="mb-2 text-sm text-zinc-500">
              Rotation style:{" "}
              <span className="text-zinc-300">{coaching.rotationStyle}</span>{" "}
              (owned by roster management; change via presets)
            </p>
            <button
              type="submit"
              className={buttonClass({ variant: "primary" })}
            >
              Save coaching
            </button>
          </div>
        </form>
      </Section>
    </>
  );
}
