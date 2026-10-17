"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import { Select } from "@/components/ui/Select";
import type {
  PlayerCardLike,
  StarterDraft,
} from "@/state/lineup-rotation-editor";

export function StartingFiveEditor(props: {
  starters: StarterDraft[];
  allPlayers: PlayerCardLike[];
  rowsById: Map<string, { targetMinutes: number }>;
  onChangeStarter: (slot: string, playerId: string) => void;
}) {
  const usedElsewhere = (currentPlayerId: string) => {
    const used = new Set(
      props.starters
        .map((slot) => slot.playerId)
        .filter((id) => id !== currentPlayerId),
    );
    return used;
  };

  return (
    <section className="space-y-3">
      <SectionHeading title="Starting Five" />
      <div className="mx-auto grid max-w-xl grid-cols-3 gap-3 text-center">
        {PLAYER_POSITIONS.map((slot) => {
          const current =
            props.starters.find((row) => row.slot === slot)?.playerId ?? "";
          const card = props.allPlayers.find((p) => p.playerId === current);
          const used = usedElsewhere(current);
          const options = props.allPlayers.filter(
            (player) =>
              player.playerId === current ||
              (!used.has(player.playerId) &&
                (player.available || player.role === "inactive")),
          );
          const mpg =
            props.rowsById.get(current)?.targetMinutes ??
            card?.plannedMinutes ??
            0;
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
              <p className="mb-2 text-sm font-medium text-team-ink">{slot}</p>
              <Select
                value={current}
                onChange={(event) =>
                  props.onChangeStarter(slot, event.target.value)
                }
                wrapperClassName="w-full"
              >
                {options.map((player) => (
                  <option
                    key={player.playerId}
                    value={player.playerId}
                    disabled={!player.available && player.playerId !== current}
                  >
                    {player.firstName} {player.lastName}
                    {!player.available ? ` (${player.availabilityLabel})` : ""}
                  </option>
                ))}
              </Select>
              {card ? (
                <p className="mt-1 text-sm text-zinc-500">
                  OVR {card.overall} · {card.position} · {mpg} MPG ·{" "}
                  {card.availabilityLabel}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
