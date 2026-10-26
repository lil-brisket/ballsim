import { notFound, redirect } from "next/navigation";
import {
  configureFantasyDraftSetupAction,
  confirmFantasyDraftSetupAction,
  randomizeFantasyDraftOrderAction,
} from "@/application/actions";
import {
  initializeFantasyDraftOrder,
  loadFantasyDraftView,
} from "@/application/game-service";
import { OnboardingShell } from "@/components/game/OnboardingShell";
import { FantasyDraftOrderEditor } from "@/components/fantasy-draft/FantasyDraftOrderEditor";
import { ErrorState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { buttonClass } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

type SetupPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function FantasyDraftSetupPage({
  params,
  searchParams,
}: SetupPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;

  await initializeFantasyDraftOrder(saveId);
  const loaded = await loadFantasyDraftView(saveId);
  if (!loaded) {
    notFound();
  }
  const { draft } = loaded;

  if (draft.orderConfirmed && draft.status !== "setup") {
    if (draft.status === "complete") {
      redirect(`/fantasy-draft/${saveId}/summary`);
    }
    redirect(`/fantasy-draft/${saveId}`);
  }

  return (
    <OnboardingShell
      step="franchise"
      title="Fantasy Draft Setup"
      subtitle="Configure draft format and order before the league begins"
    >
      {error ? <ErrorState message={error} /> : null}

      <Section title="Draft format">
        <form action={configureFantasyDraftSetupAction} className="space-y-4">
          <input type="hidden" name="saveId" value={saveId} />
          <label className="block text-sm text-soft">
            Draft type
            <Select
              name="draftType"
              defaultValue={draft.draftType}
              wrapperClassName="mt-1 w-full"
            >
              <option value="snake">Snake</option>
              <option value="linear">Linear</option>
            </Select>
          </label>
          <label className="block text-sm text-soft">
            Order mode
            <Select
              name="orderMode"
              defaultValue={draft.orderMode}
              wrapperClassName="mt-1 w-full"
            >
              <option value="random">Random (then review/edit)</option>
              <option value="manual">Manual (alphabetical start)</option>
            </Select>
          </label>
          <label className="block text-sm text-soft">
            Timer
            <Select
              name="timerSeconds"
              defaultValue={
                draft.timerEnabled ? String(draft.timerSecondsPerPick) : "off"
              }
              wrapperClassName="mt-1 w-full"
            >
              <option value="off">Off</option>
              <option value="30">30 seconds</option>
              <option value="60">60 seconds</option>
              <option value="90">90 seconds</option>
              <option value="120">120 seconds</option>
            </Select>
          </label>
          <button
            type="submit"
            className={buttonClass({ variant: "secondary" })}
          >
            Apply settings
          </button>
        </form>
      </Section>

      <Section title="Draft order">
        <div className="mb-4 flex flex-wrap gap-2">
          <form action={randomizeFantasyDraftOrderAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <button
              type="submit"
              className={buttonClass({ variant: "secondary" })}
            >
              Randomize Order
            </button>
          </form>
        </div>
        <FantasyDraftOrderEditor
          saveId={saveId}
          draftOrder={draft.draftOrder.map((entry) => ({
            pickNumber: entry.pickNumber,
            teamId: entry.teamId,
            teamName: entry.teamName,
            isUser: entry.isUser,
          }))}
        />
      </Section>

      <form action={confirmFantasyDraftSetupAction}>
        <input type="hidden" name="saveId" value={saveId} />
        <button
          type="submit"
          disabled={draft.draftOrder.length === 0}
          className={buttonClass({ variant: "primary" })}
        >
          Confirm Draft Order
        </button>
      </form>
    </OnboardingShell>
  );
}
