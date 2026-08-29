import { notFound, redirect } from "next/navigation";
import {
  configureFantasyDraftSetupAction,
  confirmFantasyDraftSetupAction,
  randomizeFantasyDraftOrderAction,
  reorderFantasyDraftAction,
} from "@/application/actions";
import {
  initializeFantasyDraftOrder,
  loadFantasyDraftView,
} from "@/application/game-service";
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
        <p className="mb-3 text-sm text-zinc-400">
          Randomize creates a starting order. Move teams up/down, then confirm to
          lock.
        </p>
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
        <ol className="space-y-2">
          {draft.draftOrder.map((entry) => (
            <li
              key={entry.teamId}
              className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2"
            >
              <span className="text-sm">
                <span className="mr-3 font-mono text-zinc-500">
                  {entry.pickNumber}.
                </span>
                {entry.teamName}
                {entry.isUser ? (
                  <span className="ml-2 rounded bg-amber-900/50 px-1.5 py-0.5 text-xs text-amber-200">
                    USER
                  </span>
                ) : (
                  <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
                    CPU
                  </span>
                )}
              </span>
              <span className="flex gap-1">
                <form action={reorderFantasyDraftAction}>
                  <input type="hidden" name="saveId" value={saveId} />
                  <input type="hidden" name="teamId" value={entry.teamId} />
                  <input type="hidden" name="direction" value={-1} />
                  <button
                    type="submit"
                    className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
                  >
                    ↑
                  </button>
                </form>
                <form action={reorderFantasyDraftAction}>
                  <input type="hidden" name="saveId" value={saveId} />
                  <input type="hidden" name="teamId" value={entry.teamId} />
                  <input type="hidden" name="direction" value={1} />
                  <button
                    type="submit"
                    className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
                  >
                    ↓
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ol>
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
