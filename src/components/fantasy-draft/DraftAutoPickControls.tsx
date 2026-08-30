import {
  advanceFantasyDraftUntilNextPickAction,
  pauseFantasyDraftAction,
  resumeFantasyDraftAction,
  setFantasyDraftAutoPickStrategyAction,
  toggleFantasyDraftAutoPickAllAction,
  undoFantasyDraftPickAction,
} from "@/application/actions";
import type { FantasyDraftView } from "@/state/selectors";

const STRATEGIES = [
  { value: "queue_then_best_fit", label: "Queue → Best fit" },
  { value: "queue_then_best_available", label: "Queue → Best available" },
  { value: "best_fit", label: "Best fit" },
  { value: "best_available", label: "Best available" },
] as const;

export function DraftAutoPickControls(props: {
  saveId: string;
  draft: FantasyDraftView;
}) {
  const { saveId, draft } = props;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {draft.paused ? (
        <form action={resumeFantasyDraftAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <button
            type="submit"
            className="rounded-md bg-amber-600 px-3 py-2 text-sm text-zinc-950"
          >
            Resume Draft
          </button>
        </form>
      ) : (
        <form action={pauseFantasyDraftAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <button
            type="submit"
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm"
          >
            Pause Draft
          </button>
        </form>
      )}

      <form action={toggleFantasyDraftAutoPickAllAction}>
        <input type="hidden" name="saveId" value={saveId} />
        <input type="hidden" name="enabled" value="true" />
        <button
          type="submit"
          className="rounded-md border border-zinc-700 px-3 py-2 text-sm"
        >
          Auto-pick all my teams
        </button>
      </form>

      <form action={advanceFantasyDraftUntilNextPickAction}>
        <input type="hidden" name="saveId" value={saveId} />
        <button
          type="submit"
          className="rounded-md border border-zinc-700 px-3 py-2 text-sm"
        >
          Auto-pick until my next pick
        </button>
      </form>

      <form action={undoFantasyDraftPickAction}>
        <input type="hidden" name="saveId" value={saveId} />
        <button
          type="submit"
          className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-400"
        >
          Undo last pick
        </button>
      </form>

      <form
        action={setFantasyDraftAutoPickStrategyAction}
        className="flex items-center gap-2"
      >
        <input type="hidden" name="saveId" value={saveId} />
        <input type="hidden" name="teamId" value={draft.activeOwnerTeamId} />
        <label className="text-xs text-zinc-500" htmlFor="auto-strategy">
          Strategy
        </label>
        <select
          id="auto-strategy"
          name="strategy"
          defaultValue={draft.autoPickStrategy}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
        >
          {STRATEGIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </form>
    </div>
  );
}
