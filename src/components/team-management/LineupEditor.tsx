"use client";

import { useMemo, useState } from "react";
import {
  applyLineupRecommendationAction,
  updateLineupAction,
} from "@/application/actions";
import type { LineupView } from "@/state/team-management-selectors";
import type { TeamRosterManagement } from "@/domain/entities/team-roster-management";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import { DataTable } from "@/components/owner/DataTable";
import { StatusBadge } from "@/components/owner/StatusBadge";

type StarterDraft = { playerId: string; slot: string };

export function LineupEditor(props: {
  saveId: string;
  lineup: LineupView;
  recommendation: TeamRosterManagement;
}) {
  const returnPath = `/dashboard/${props.saveId}/team-management/lineups`;
  const allPlayers = useMemo(
    () => [...props.lineup.starters, ...props.lineup.bench, ...props.lineup.inactive],
    [props.lineup],
  );

  const [starters, setStarters] = useState<StarterDraft[]>(
    props.lineup.starters.map((player) => ({
      playerId: player.playerId as string,
      slot: (player.slot ?? player.position) as string,
    })),
  );
  const [bench, setBench] = useState<string[]>(
    props.lineup.bench.map((p) => p.playerId as string),
  );
  const [inactive, setInactive] = useState<string[]>(
    props.lineup.inactive.map((p) => p.playerId as string),
  );
  const [previewRecommend, setPreviewRecommend] = useState(false);

  function playerLabel(playerId: string): string {
    const player = allPlayers.find((row) => row.playerId === playerId);
    if (!player) {
      return playerId;
    }
    return `${player.firstName} ${player.lastName} (${player.overall})`;
  }

  function availableOptions(currentPlayerId: string) {
    const usedElsewhere = new Set(
      [
        ...starters.map((slot) => slot.playerId),
        ...bench,
        ...inactive,
      ].filter((id) => id !== currentPlayerId),
    );
    return allPlayers.filter(
      (player) =>
        player.playerId === currentPlayerId ||
        (!usedElsewhere.has(player.playerId) &&
          (player.available || player.role === "inactive")),
    );
  }

  function setStarterSlot(slot: string, playerId: string) {
    const previous = starters.find((row) => row.slot === slot)?.playerId;
    setStarters((current) =>
      current.map((row) => (row.slot === slot ? { ...row, playerId } : row)),
    );
    setBench((current) => {
      let next = current.filter((id) => id !== playerId);
      if (previous && previous !== playerId && !next.includes(previous)) {
        next = [...next, previous];
      }
      return next;
    });
    setInactive((current) => current.filter((id) => id !== playerId));
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Starting five
        </h2>
        <div className="mx-auto grid max-w-xl grid-cols-3 gap-3 text-center">
          {PLAYER_POSITIONS.map((slot) => {
            const current =
              starters.find((row) => row.slot === slot)?.playerId ?? "";
            const card = allPlayers.find((player) => player.playerId === current);
            return (
              <div
                key={slot}
                className={`rounded-lg border border-zinc-700 p-3 ${
                  slot === "PG" || slot === "C"
                    ? "col-start-2"
                    : slot === "SG"
                      ? "col-start-1"
                      : slot === "SF"
                        ? "col-start-3"
                        : "col-start-2"
                }`}
              >
                <p className="mb-2 font-mono text-xs text-amber-400">{slot}</p>
                <select
                  value={current}
                  onChange={(event) => setStarterSlot(slot, event.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
                >
                  {availableOptions(current).map((player) => (
                    <option
                      key={player.playerId}
                      value={player.playerId}
                      disabled={!player.available && player.playerId !== current}
                    >
                      {player.firstName} {player.lastName}
                      {!player.available ? ` (${player.availabilityLabel})` : ""}
                    </option>
                  ))}
                </select>
                {card ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    OVR {card.overall} · {card.plannedMinutes} min
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Bench
        </h2>
        <DataTable headers={["Player", "Pos", "Role", "Planned", "Status"]}>
          {bench.map((playerId) => {
            const player = allPlayers.find((row) => row.playerId === playerId);
            if (!player) {
              return null;
            }
            return (
              <tr key={playerId} className="border-t border-zinc-800">
                <td className="px-3 py-2 text-zinc-100">
                  {player.firstName} {player.lastName}
                </td>
                <td className="px-3 py-2 font-mono text-zinc-400">
                  {player.position}
                </td>
                <td className="px-3 py-2 text-zinc-400">{player.archetypeLabel}</td>
                <td className="px-3 py-2 text-zinc-300">{player.plannedMinutes}</td>
                <td className="px-3 py-2">
                  <StatusBadge label={player.availabilityLabel} />
                </td>
              </tr>
            );
          })}
        </DataTable>
      </section>

      {inactive.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Inactive
          </h2>
          <ul className="space-y-1 text-sm text-zinc-400">
            {inactive.map((playerId) => (
              <li key={playerId}>{playerLabel(playerId)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPreviewRecommend(true)}
          className="rounded-md border border-zinc-600 px-3 py-2 text-sm text-zinc-200 hover:border-amber-600"
        >
          Recommend
        </button>
        <form action={updateLineupAction}>
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="teamId" value={props.lineup.teamId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <input
            type="hidden"
            name="startingLineupJson"
            value={JSON.stringify(starters)}
          />
          <input type="hidden" name="benchJson" value={JSON.stringify(bench)} />
          <input
            type="hidden"
            name="inactiveJson"
            value={JSON.stringify(inactive)}
          />
          <button
            type="submit"
            className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
          >
            Save changes
          </button>
        </form>
      </div>

      {previewRecommend ? (
        <div className="rounded-xl border border-amber-700/50 bg-zinc-950 p-4">
          <h3 className="text-sm font-semibold text-amber-400">
            Recommended rotation
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Uses current player availability and roster strengths to generate a
            balanced lineup. Apply only after confirming.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-zinc-200">
            {props.recommendation.startingLineup.map((slot) => (
              <li key={slot.slot}>
                <span className="font-mono text-amber-400">{slot.slot}</span>{" "}
                {playerLabel(slot.playerId)}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <form action={applyLineupRecommendationAction}>
              <input type="hidden" name="saveId" value={props.saveId} />
              <input type="hidden" name="teamId" value={props.lineup.teamId} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <button
                type="submit"
                className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-zinc-950"
              >
                Apply recommendation
              </button>
            </form>
            <button
              type="button"
              onClick={() => setPreviewRecommend(false)}
              className="rounded-md border border-zinc-600 px-3 py-2 text-sm text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
