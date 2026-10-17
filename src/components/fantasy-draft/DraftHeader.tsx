import type { FantasyDraftView } from "@/state/selectors";

export function DraftHeader(props: { draft: FantasyDraftView }) {
  const { draft } = props;
  const pickLabel =
    draft.currentPickNumber != null
      ? `Pick ${draft.currentPickNumber} / ${draft.totalPicks}`
      : `— / ${draft.totalPicks}`;

  const statusLabel = draft.paused
    ? "Draft paused"
    : draft.onClockIsUser
      ? "Your pick · on the clock"
      : "AI pick";

  return (
    <header className="rounded-xl border border-team-ink/50 bg-team/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm text-team-ink">
            Round {draft.currentRound ?? "—"} · {pickLabel}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-zinc-50">
            {draft.onClockTeamName ?? "—"}
          </h1>
          <p
            className={`mt-1 text-sm font-semibold ${
              draft.paused
                ? "text-zinc-400"
                : draft.onClockIsUser
                  ? "text-team-ink"
                  : "text-sky-300"
            }`}
          >
            {statusLabel}
          </p>
          {draft.nextTeamName ? (
            <p className="mt-2 text-sm text-zinc-400">
              Next: {draft.nextTeamName}
            </p>
          ) : null}
        </div>
        <div className="min-w-[140px] text-right">
          {draft.timerEnabled ? (
            <p className="font-mono text-3xl text-zinc-100">
              {draft.paused ? "⏸ " : ""}
              {draft.remainingSeconds ?? "—"}s
            </p>
          ) : null}
          <div className="mt-2">
            <div className="mb-1 text-sm text-zinc-400">
              Draft progress · {draft.draftProgressPercent}%
            </div>
            <div className="h-2 w-40 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-team-ink"
                style={{ width: `${draft.draftProgressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
