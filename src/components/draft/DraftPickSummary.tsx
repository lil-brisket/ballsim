"use client";

import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DraftPickSummaryRow } from "@/state/draft-hub-selectors";

export function DraftPickSummary(props: {
  saveId: string;
  picks: readonly DraftPickSummaryRow[];
}) {
  if (props.picks.length === 0) {
    return <EmptyState message="No draft picks in the current order." />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-line bg-surface-raised/60 text-sm text-faint">
          <tr>
            <th className="px-3 py-2 font-medium">Pick</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 font-medium">Player</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {props.picks.map((pick) => (
            <tr
              key={pick.draftPickId}
              className={pick.isUserPick ? "bg-team/15" : undefined}
            >
              <td className="px-3 py-2 font-mono tabular-nums text-soft">
                #{pick.overallPick}
                <span className="ml-1 text-disabled">R{pick.round}</span>
              </td>
              <td className="px-3 py-2">
                <TeamEntityLink saveId={props.saveId} teamId={pick.ownerTeamId}>
                  {pick.ownerAbbreviation}
                  {pick.isUserPick ? " (you)" : ""}
                </TeamEntityLink>
              </td>
              <td className="px-3 py-2 text-ink">
                {pick.selectedPlayerId && pick.selectedPlayerName ? (
                  <PlayerEntityLink
                    saveId={props.saveId}
                    playerId={pick.selectedPlayerId}
                  >
                    {pick.selectedPlayerName}
                  </PlayerEntityLink>
                ) : (
                  <span className="text-disabled">—</span>
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
