"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { PlayerChip } from "@/components/team-management/PlayerChip";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import type {
  EditableRotationRow,
  PlayerCardLike,
} from "@/state/lineup-rotation-editor";

export function BenchEditor(props: {
  bench: string[];
  inactive: string[];
  allPlayers: PlayerCardLike[];
  rowsById: Map<string, EditableRotationRow>;
  onMoveToInactive: (playerId: string) => void;
  onMoveToBench: (playerId: string) => void;
  portraits?: Record<string, PlayerPortraitAssignment | null>;
}) {
  const find = (playerId: string) =>
    props.allPlayers.find((p) => p.playerId === playerId);

  return (
    <div className="space-y-6">
      <section>
        <SectionHeading title="Bench" className="mb-3" />
        {props.bench.length === 0 ? (
          <p className="text-sm text-zinc-400">No bench players.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {props.bench.map((playerId) => {
              const player = find(playerId);
              if (!player) {
                return null;
              }
              return (
                <li key={playerId} className="flex flex-col items-center gap-1">
                  <PlayerChip
                    player={player}
                    portrait={props.portraits?.[playerId]}
                    slotLabel={player.position}
                    readOnly
                  />
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => props.onMoveToInactive(playerId)}
                    aria-label={`Make ${player.firstName} ${player.lastName} inactive`}
                  >
                    Make inactive
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionHeading title="Inactive" className="mb-3" />
        {props.inactive.length === 0 ? (
          <p className="text-sm text-zinc-500">No inactive players.</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {props.inactive.map((playerId) => {
              const player = find(playerId);
              if (!player) {
                return null;
              }
              return (
                <li key={playerId} className="flex flex-col items-center gap-1">
                  <PlayerChip
                    player={player}
                    portrait={props.portraits?.[playerId]}
                    slotLabel={player.position}
                    readOnly
                    className="opacity-60"
                  />
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => props.onMoveToBench(playerId)}
                    aria-label={`Move ${player.firstName} ${player.lastName} to bench`}
                  >
                    Move to bench
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
