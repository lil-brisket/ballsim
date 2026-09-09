"use client";

import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/owner/EmptyState";
import type { DraftPickSummaryRow } from "@/state/draft-hub-selectors";

export function DraftPickSummary(props: {
  saveId: string;
  picks: readonly DraftPickSummaryRow[];
}) {
  if (props.picks.length === 0) {
    return <EmptyState message="No draft picks in the current order." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-800 bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">Pick</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 font-medium">Player</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {props.picks.map((pick) => (
            <tr
              key={pick.draftPickId}
              className={pick.isUserPick ? "bg-amber-950/20" : undefined}
            >
              <td className="px-3 py-2 font-mono text-zinc-300">
                #{pick.overallPick}
                <span className="ml-1 text-zinc-600">R{pick.round}</span>
              </td>
              <td className="px-3 py-2">
                <TeamEntityLink
                  saveId={props.saveId}
                  teamId={pick.ownerTeamId}
                >
                  {pick.ownerAbbreviation}
                  {pick.isUserPick ? " (you)" : ""}
                </TeamEntityLink>
              </td>
              <td className="px-3 py-2 text-zinc-200">
                {pick.selectedPlayerId && pick.selectedPlayerName ? (
                  <PlayerEntityLink
                    saveId={props.saveId}
                    playerId={pick.selectedPlayerId}
                  >
                    {pick.selectedPlayerName}
                  </PlayerEntityLink>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                <StatusBadge label={pick.status.replaceAll("_", " ")} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
