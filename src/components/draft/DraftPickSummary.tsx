"use client";

import { rowLinkClass } from "@/components/league/row-link-class";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { DataTable } from "@/components/ui/DataTable";
import { cn } from "@/components/ui/styles";
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
    <DataTable
      caption="Draft picks"
      headers={["Pick", "Team", "Player", "Status"]}
    >
      {props.picks.map((pick) => (
        <tr
          key={pick.draftPickId}
          className={cn(
            pick.isUserPick &&
              "shadow-[inset_3px_0_0_0_rgb(var(--team-ink-rgb))]",
          )}
        >
          <td className="px-3 py-2 font-mono tabular-nums text-soft">
            #{pick.overallPick}
            <span className="ml-1 text-disabled">R{pick.round}</span>
          </td>
          <td className="px-3 py-2">
            <TeamEntityLink
              saveId={props.saveId}
              teamId={pick.ownerTeamId}
              className={rowLinkClass}
            >
              {pick.ownerAbbreviation}
              {pick.isUserPick ? " (you)" : ""}
            </TeamEntityLink>
          </td>
          <td className="px-3 py-2 text-ink">
            {pick.selectedPlayerId && pick.selectedPlayerName ? (
              <PlayerEntityLink
                saveId={props.saveId}
                playerId={pick.selectedPlayerId}
                className={rowLinkClass}
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
    </DataTable>
  );
}
