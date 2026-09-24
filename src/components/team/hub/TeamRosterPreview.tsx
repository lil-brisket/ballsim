import Link from "next/link";
import { RosterRow } from "@/components/basketball/RosterRow";
import { Section } from "@/components/owner/Section";
import { cn, panelClass } from "@/components/ui/styles";
import type { TeamHubView } from "@/state/team-hub-selectors";

export function TeamRosterPreview(props: {
  saveId: string;
  hub: TeamHubView;
}) {
  const { saveId, hub } = props;
  const rosterHref = `/dashboard/${saveId}/roster`;

  return (
    <Section
      title="Roster"
      action={
        <Link href={rosterHref} className="text-sm text-amber-400">
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
            firstName={player.firstName}
            lastName={player.lastName}
            position={player.position}
            overall={player.overall}
            age={player.age}
            injuryStatus={
              player.injuryKind !== "available" ? player.injuryKind : undefined
            }
          />
        ))}
        {hub.injuredPlayers.length > 0 ? (
          <div className="mt-3 border-t border-zinc-800 pt-2">
            <p className="mb-1 font-mono text-[0.65rem] uppercase text-rose-400">
              Injured
            </p>
            {hub.injuredPlayers.map((player) => (
              <RosterRow
                key={`inj-${player.playerId}`}
                saveId={saveId}
                playerId={player.playerId}
                firstName={player.firstName}
                lastName={player.lastName}
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
            className="text-sm text-amber-400 hover:text-amber-300"
          >
            View Roster →
          </Link>
        </div>
      </div>
    </Section>
  );
}
