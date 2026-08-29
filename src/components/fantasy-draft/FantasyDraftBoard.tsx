"use client";

import { useMemo, useState, useTransition } from "react";
import type { FantasyDraftView } from "@/state/selectors";
import {
  fantasyDraftPickAction,
  pauseFantasyDraftAction,
  resumeFantasyDraftAction,
  toggleFantasyDraftAutoPickAction,
  toggleFantasyDraftAutoPickAllAction,
  undoFantasyDraftPickAction,
} from "@/application/actions";
import { switchActiveOwnerTeamAction } from "@/application/actions";

type Props = {
  saveId: string;
  draft: FantasyDraftView;
  error?: string;
};

export function FantasyDraftBoard({ saveId, draft, error }: Props) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("ALL");
  const [sort, setSort] = useState<"overall" | "potential" | "age">("overall");
  const [pendingPlayer, setPendingPlayer] = useState<{
    playerId: string;
    name: string;
    position: string;
    overall: number;
    potential: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const remaining = useMemo(() => {
    if (!draft.timerEnabled || !draft.pickStartedAt || draft.paused) {
      return draft.remainingSeconds;
    }
    // Presentation-only: derive from pickStartedAt on client
    const started = Date.parse(draft.pickStartedAt);
    if (!Number.isFinite(started)) {
      return draft.remainingSeconds;
    }
    const expires = started + draft.timerSecondsPerPick * 1000;
    return Math.max(0, Math.ceil((expires - Date.now()) / 1000));
  }, [draft]);

  const filtered = useMemo(() => {
    let rows = draft.availablePlayers;
    if (position !== "ALL") {
      rows = rows.filter((p) => p.position === position);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q),
      );
    }
    rows = [...rows].sort((a, b) => {
      if (sort === "potential") {
        return b.potential - a.potential;
      }
      if (sort === "age") {
        return a.age - b.age;
      }
      return b.overall - a.overall;
    });
    return rows.slice(0, 80);
  }, [draft.availablePlayers, position, query, sort]);

  const recent = draft.selections.slice(-8).reverse();

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <header className="rounded-xl border border-amber-800/40 bg-amber-950/30 p-5">
          <div className="text-xs uppercase tracking-wide text-amber-300/80">
            Round {draft.currentRound ?? "—"} · Pick{" "}
            {draft.currentPickNumber ?? "—"} / {draft.totalPicks}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-amber-50">
            {draft.onClockTeamName ?? "—"}
          </h1>
          <p className="mt-1 text-sm font-medium text-amber-200">
            {draft.paused
              ? "DRAFT PAUSED"
              : draft.onClockIsUser
                ? "YOUR PICK"
                : "CPU PICKING..."}
          </p>
          {draft.timerEnabled ? (
            <p className="mt-2 font-mono text-3xl text-amber-100">
              {draft.paused ? "⏸" : ""} {remaining ?? "—"}s
            </p>
          ) : null}
          {draft.nextTeamName ? (
            <p className="mt-2 text-sm text-zinc-400">
              Next: {draft.nextTeamName}
            </p>
          ) : null}
        </header>

        {error ? (
          <p className="rounded-md border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
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
          <form action={undoFantasyDraftPickAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <button
              type="submit"
              className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-400"
            >
              Undo last pick
            </button>
          </form>
        </div>

        <section className="rounded-xl border border-zinc-800 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Controlled franchises
          </h2>
          <ul className="space-y-2">
            {draft.controlledFranchises.map((team) => (
              <li
                key={team.teamId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm"
              >
                <span>
                  {team.teamName}
                  {team.isActive ? " ← Current" : ""}
                  {team.isOnClock ? (
                    <span className="ml-2 text-amber-300">On clock</span>
                  ) : null}
                </span>
                <span className="flex gap-2">
                  <form action={switchActiveOwnerTeamAction}>
                    <input type="hidden" name="saveId" value={saveId} />
                    <input type="hidden" name="teamId" value={team.teamId} />
                    <input
                      type="hidden"
                      name="returnPath"
                      value={`/fantasy-draft/${saveId}`}
                    />
                    <button
                      type="submit"
                      className="rounded border border-zinc-700 px-2 py-1 text-xs"
                    >
                      Switch
                    </button>
                  </form>
                  <form action={toggleFantasyDraftAutoPickAction}>
                    <input type="hidden" name="saveId" value={saveId} />
                    <input type="hidden" name="teamId" value={team.teamId} />
                    <input
                      type="hidden"
                      name="enabled"
                      value={team.autoPick ? "false" : "true"}
                    />
                    <button
                      type="submit"
                      className="rounded border border-zinc-700 px-2 py-1 text-xs"
                    >
                      {team.autoPick ? "Auto ON" : "Manual"}
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-800 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            />
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              <option value="ALL">All positions</option>
              {["PG", "SG", "SF", "PF", "C"].map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) =>
                setSort(e.target.value as "overall" | "potential" | "age")
              }
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
            >
              <option value="overall">Overall</option>
              <option value="potential">Potential</option>
              <option value="age">Age</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-2">Player</th>
                  <th>Pos</th>
                  <th>OVR</th>
                  <th>POT</th>
                  <th>Age</th>
                  <th>Tier</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((player) => (
                  <tr key={player.playerId} className="border-t border-zinc-800">
                    <td className="py-2">
                      {player.firstName} {player.lastName}
                    </td>
                    <td>{player.position}</td>
                    <td>{player.overall}</td>
                    <td>{player.potential}</td>
                    <td>{player.age}</td>
                    <td className="capitalize text-zinc-400">{player.tier}</td>
                    <td>
                      {draft.userOnClock && !draft.paused ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            setPendingPlayer({
                              playerId: player.playerId,
                              name: `${player.firstName} ${player.lastName}`,
                              position: player.position,
                              overall: player.overall,
                              potential: player.potential,
                            })
                          }
                          className="rounded bg-amber-700/80 px-2 py-1 text-xs text-amber-50 disabled:opacity-50"
                        >
                          Draft
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-xl border border-zinc-800 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase text-zinc-400">
            Current roster ({draft.activeRoster.length}/{draft.picksPerTeam})
          </h2>
          <div className="mb-3 flex flex-wrap gap-2 text-xs text-zinc-400">
            {draft.positionCounts.map((row) => (
              <span key={row.position}>
                {row.position}: {row.count}
              </span>
            ))}
          </div>
          <ul className="space-y-1 text-sm">
            {draft.activeRoster.length === 0 ? (
              <li className="text-zinc-500">Empty</li>
            ) : (
              draft.activeRoster.map((p) => (
                <li key={p.playerId}>
                  <span className="text-zinc-500">{p.position}</span> {p.name}{" "}
                  <span className="text-zinc-500">({p.overall})</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-800 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase text-zinc-400">
            Recent picks
          </h2>
          <ul className="space-y-1 text-sm">
            {recent.map((sel) => (
              <li key={sel.pickNumber}>
                {sel.pickNumber}. {sel.teamAbbreviation} — {sel.playerName}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-zinc-800 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase text-zinc-400">
            Draft order
          </h2>
          <ol className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {draft.draftOrder.map((entry) => (
              <li
                key={entry.teamId}
                className={
                  entry.teamId === draft.onClockTeamId
                    ? "text-amber-300"
                    : "text-zinc-400"
                }
              >
                {entry.pickNumber}. {entry.abbreviation}
                {entry.isUser ? " · USER" : ""}
              </li>
            ))}
          </ol>
        </section>
      </aside>

      {pendingPlayer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6">
            <h3 className="text-lg font-semibold">Confirm pick</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Draft {pendingPlayer.name}? ({pendingPlayer.position},{" "}
              {pendingPlayer.overall} OVR, {pendingPlayer.potential} POT)
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingPlayer(null)}
                className="rounded-md border border-zinc-700 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <form
                action={fantasyDraftPickAction}
                onSubmit={() => {
                  startTransition(() => setPendingPlayer(null));
                }}
              >
                <input type="hidden" name="saveId" value={saveId} />
                <input
                  type="hidden"
                  name="playerId"
                  value={pendingPlayer.playerId}
                />
                <button
                  type="submit"
                  className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-zinc-950"
                >
                  Confirm Pick
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
