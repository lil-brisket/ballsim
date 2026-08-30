import {
  removeFantasyDraftQueuePlayerAction,
  reorderFantasyDraftQueueAction,
} from "@/application/actions";
import type { FantasyDraftView } from "@/state/selectors";

export function DraftQueuePanel(props: {
  saveId: string;
  draft: FantasyDraftView;
  pending?: boolean;
  onConfirmDraft?: (player: {
    playerId: string;
    name: string;
    position: string;
    overall: number;
    potential: number;
  }) => void;
}) {
  const { saveId, draft, pending, onConfirmDraft } = props;
  const activeTeam = draft.controlledFranchises.find((t) => t.isActive);
  const teamId = draft.activeOwnerTeamId;
  const canDraft =
    draft.userOnClock &&
    !draft.paused &&
    draft.onClockTeamId === teamId;

  return (
    <section className="rounded-xl border border-zinc-800 p-4">
      <h2 className="mb-2 text-sm font-semibold uppercase text-zinc-400">
        Draft queue
        {activeTeam ? (
          <span className="ml-2 font-normal normal-case text-zinc-500">
            · {activeTeam.abbreviation}
          </span>
        ) : null}
      </h2>
      {draft.queue.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No players queued. Add players from the player card.
        </p>
      ) : (
        <ul className="space-y-2">
          {draft.queue.map((entry, index) => {
            const ids = draft.queue.map((q) => q.playerId);
            const moveUp = [...ids];
            if (index > 0) {
              const tmp = moveUp[index]!;
              moveUp[index] = moveUp[index - 1]!;
              moveUp[index - 1] = tmp;
            }
            const moveDown = [...ids];
            if (index < ids.length - 1) {
              const tmp = moveDown[index]!;
              moveDown[index] = moveDown[index + 1]!;
              moveDown[index + 1] = tmp;
            }

            return (
              <li
                key={entry.playerId}
                className={`rounded-lg border px-2 py-2 text-sm ${
                  entry.isAvailable
                    ? "border-zinc-800"
                    : "border-zinc-800/60 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-zinc-100">
                      {entry.firstName} {entry.lastName}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {entry.position} · {entry.overall} OVR · {entry.potential}{" "}
                      POT
                    </div>
                    {!entry.isAvailable ? (
                      <div className="mt-1 text-xs text-amber-500/90">
                        Drafted by {entry.draftedByAbbreviation ?? "—"}
                        {entry.pickNumber != null
                          ? ` · Pick #${entry.pickNumber}`
                          : ""}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    {entry.isAvailable ? (
                      <>
                        <div className="flex gap-1">
                          <form action={reorderFantasyDraftQueueAction}>
                            <input type="hidden" name="saveId" value={saveId} />
                            <input type="hidden" name="teamId" value={teamId} />
                            <input
                              type="hidden"
                              name="orderedPlayerIds"
                              value={moveUp.join(",")}
                            />
                            <button
                              type="submit"
                              disabled={index === 0}
                              className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] disabled:opacity-30"
                              aria-label="Move up in queue"
                            >
                              ↑
                            </button>
                          </form>
                          <form action={reorderFantasyDraftQueueAction}>
                            <input type="hidden" name="saveId" value={saveId} />
                            <input type="hidden" name="teamId" value={teamId} />
                            <input
                              type="hidden"
                              name="orderedPlayerIds"
                              value={moveDown.join(",")}
                            />
                            <button
                              type="submit"
                              disabled={index >= draft.queue.length - 1}
                              className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] disabled:opacity-30"
                              aria-label="Move down in queue"
                            >
                              ↓
                            </button>
                          </form>
                        </div>
                        {canDraft ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              onConfirmDraft?.({
                                playerId: entry.playerId,
                                name: `${entry.firstName} ${entry.lastName}`,
                                position: entry.position,
                                overall: entry.overall,
                                potential: entry.potential,
                              })
                            }
                            className="rounded bg-amber-700/80 px-2 py-0.5 text-[10px] text-amber-50 disabled:opacity-50"
                          >
                            Draft
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    <form action={removeFantasyDraftQueuePlayerAction}>
                      <input type="hidden" name="saveId" value={saveId} />
                      <input type="hidden" name="teamId" value={teamId} />
                      <input
                        type="hidden"
                        name="playerId"
                        value={entry.playerId}
                      />
                      <button
                        type="submit"
                        className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
