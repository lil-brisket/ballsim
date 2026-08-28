import { notFound } from "next/navigation";
import {
  applyCoachingPresetAction,
  updateCoachingPhilosophyAction,
} from "@/application/actions";
import { loadTeamManagementView } from "@/application/game-service";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { Section } from "@/components/owner/Section";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function CoachingPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadTeamManagementView(saveId);
  if (!view) {
    notFound();
  }

  const { coaching } = view;
  const returnPath = `/dashboard/${saveId}/team-management/coaching`;

  return (
    <>
      <PageHeader
        title="Coaching"
        subtitle="Team play style that feeds the simulation engine"
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
                className={`rounded-full border px-3 py-1 text-xs ${
                  coaching.activePreset === preset.id
                    ? "border-amber-600 text-amber-400"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
              >
                {preset.label}
              </button>
            </form>
          ))}
        </div>
      </Section>

      <Section title="Philosophy">
        <form action={updateCoachingPhilosophyAction} className="grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="teamId" value={coaching.teamId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Pace
            <select
              name="pace"
              defaultValue={coaching.philosophy.pace}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="fast">Fast</option>
              <option value="balanced">Balanced</option>
              <option value="halfCourt">Half court</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Offensive emphasis
            <select
              name="offensiveEmphasis"
              defaultValue={coaching.philosophy.offensiveEmphasis}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="threePointHeavy">Three-point heavy</option>
              <option value="balanced">Balanced</option>
              <option value="inside">Inside</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Defensive approach
            <select
              name="defensiveApproach"
              defaultValue={coaching.philosophy.defensiveApproach}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="aggressive">Aggressive</option>
              <option value="balanced">Balanced</option>
              <option value="conservative">Conservative</option>
            </select>
          </label>
          <div className="sm:col-span-3">
            <p className="mb-2 text-xs text-zinc-500">
              Rotation style: <span className="text-zinc-300">{coaching.rotationStyle}</span>{" "}
              (owned by roster management; change via presets)
            </p>
            <button
              type="submit"
              className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
            >
              Save coaching
            </button>
          </div>
        </form>
      </Section>
    </>
  );
}
