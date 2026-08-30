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
import { FantasyDraftOrderEditor } from "@/components/fantasy-draft/FantasyDraftOrderEditor";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";

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
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 text-zinc-100">
      <PageHeader
        title="Fantasy Draft Setup"
        subtitle="Configure draft format and order before the league begins"
      />
      {error ? <ErrorState message={error} /> : null}

      <Section title="Draft format">
        <form action={configureFantasyDraftSetupAction} className="space-y-4">
          <input type="hidden" name="saveId" value={saveId} />
          <label className="block text-sm text-zinc-300">
            Draft type
            <select
              name="draftType"
              defaultValue={draft.draftType}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
            >
              <option value="snake">Snake</option>
              <option value="linear">Linear</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-300">
            Order mode
            <select
              name="orderMode"
              defaultValue={draft.orderMode}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
            >
              <option value="random">Random (then review/edit)</option>
              <option value="manual">Manual (alphabetical start)</option>
            </select>
          </label>
          <label className="block text-sm text-zinc-300">
            Timer
            <select
              name="timerSeconds"
              defaultValue={
                draft.timerEnabled ? String(draft.timerSecondsPerPick) : "off"
              }
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
            >
              <option value="off">Off</option>
              <option value="30">30 seconds</option>
              <option value="60">60 seconds</option>
              <option value="90">90 seconds</option>
              <option value="120">120 seconds</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-700"
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
              className="rounded-md border border-amber-700/60 px-3 py-2 text-sm text-amber-200 hover:bg-amber-950/40"
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
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 disabled:opacity-50"
        >
          Confirm Draft Order
        </button>
      </form>
    </main>
  );
}
