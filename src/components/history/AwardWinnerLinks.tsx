import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import type { AwardsHubRow } from "@/state/awards-hub-selectors";

export function AwardWinnerName(props: { saveId: string; row: AwardsHubRow }) {
  if (props.row.winnerSubjectType !== "player") {
    return <span className="text-ink">{props.row.winnerName}</span>;
  }
  return (
    <PlayerEntityLink
      saveId={props.saveId}
      playerId={props.row.winnerSubjectId}
    >
      {props.row.winnerName}
    </PlayerEntityLink>
  );
}

export function AwardWinnerTeam(props: { saveId: string; row: AwardsHubRow }) {
  if (!props.row.winnerTeamId || !props.row.teamName) {
    return <span className="text-faint">{props.row.teamName ?? "—"}</span>;
  }
  return (
    <TeamEntityLink saveId={props.saveId} teamId={props.row.winnerTeamId}>
      {props.row.teamName}
    </TeamEntityLink>
  );
}
