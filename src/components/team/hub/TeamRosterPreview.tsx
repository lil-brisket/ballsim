import Link from "next/link";
import { RosterRow } from "@/components/basketball/RosterRow";
import { Section } from "@/components/ui/Section";
import {
  cn,
  focusRingClass,
  linkClass,
  panelClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import type { TeamHubView } from "@/state/team-hub-selectors";

export function TeamRosterPreview(props: { saveId: string; hub: TeamHubView }) {
  const { saveId, hub } = props;
  const rosterHref = `/dashboard/${saveId}/roster`;

  return (
    <Section
      title="Roster"
      action={
        <Link
          href={rosterHref}
          className={cn(linkClass, touchTargetTextClass, focusRingClass)}
        >
          View Roster
        </Link>
      }
    >
      <div className={cn(panelClass, "px-4 py-2")}>
        {hub.corePlayers.map((player) => (
          <RosterRow
            key={player.playerId}
            saveId={saveId}
            playerId={player.playerId}
            portrait={player.portrait}
            firstName={player.firstName}
            lastName={player.lastName}
            jerseyNumber={player.jerseyNumber}
            position={player.position}
            overall={player.overall}
            age={player.age}
            injuryStatus={
              player.injuryKind !== "available" ? player.injuryKind : undefined
            }
          />
        ))}
        {hub.injuredPlayers.length > 0 ? (
          <div className="mt-3 border-t border-line pt-2">
            <p className="mb-1 text-sm text-danger">Injured</p>
            {hub.injuredPlayers.map((player) => (
              <RosterRow
                key={`inj-${player.playerId}`}
                saveId={saveId}
                playerId={player.playerId}
                portrait={player.portrait}
                firstName={player.firstName}
                lastName={player.lastName}
                jerseyNumber={player.jerseyNumber}
                position={player.position}
                overall={player.overall}
                injuryStatus={player.injuryKind}
              />
            ))}
          </div>
        ) : null}
        <div className="py-2">
          <Link
            href={rosterHref}
            className={cn(linkClass, touchTargetTextClass, focusRingClass)}
          >
            View Roster →
          </Link>
        </div>
      </div>
    </Section>
  );
}
