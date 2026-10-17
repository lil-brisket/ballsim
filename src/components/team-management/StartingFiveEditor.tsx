"use client";

import { useState } from "react";
import { LineupCourt } from "@/components/team-management/LineupCourt";
import { PlayerChip } from "@/components/team-management/PlayerChip";
import { PlayerPicker } from "@/components/team-management/PlayerPicker";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import type {
  PlayerCardLike,
  StarterDraft,
} from "@/state/lineup-rotation-editor";

/** Chip centre on the half court, as percentages of its width and height. */
const SLOT_POSITION: Record<string, { left: number; top: number }> = {
  PG: { left: 50, top: 17 },
  SG: { left: 17, top: 41 },
  SF: { left: 83, top: 41 },
  PF: { left: 27, top: 79 },
  C: { left: 73, top: 79 },
};

export function StartingFiveEditor(props: {
  starters: StarterDraft[];
  allPlayers: PlayerCardLike[];
  rowsById: Map<string, { targetMinutes: number }>;
  onChangeStarter: (slot: string, playerId: string) => void;
  portraits?: Record<string, PlayerPortraitAssignment | null>;
}) {
  const [pickerSlot, setPickerSlot] = useState<string | null>(null);

  const currentFor = (slot: string) =>
    props.starters.find((row) => row.slot === slot)?.playerId ?? "";

  const eligibleFor = (slot: string) => {
    const current = currentFor(slot);
    const used = new Set(
      props.starters.map((s) => s.playerId).filter((id) => id !== current),
    );
    return props.allPlayers.filter(
      (player) =>
        player.playerId === current ||
        (!used.has(player.playerId) &&
          (player.available || player.role === "inactive")),
    );
  };

  return (
    <section className="space-y-3">
      <SectionHeading title="Starting Five" />
      <LineupCourt>
        {PLAYER_POSITIONS.map((slot) => {
          const current = currentFor(slot);
          const card =
            props.allPlayers.find((p) => p.playerId === current) ?? null;
          const pos = SLOT_POSITION[slot] ?? { left: 50, top: 50 };
          return (
            <div
              key={slot}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
            >
              <PlayerChip
                player={card}
                portrait={card ? props.portraits?.[card.playerId] : null}
                slotLabel={slot}
                opensPicker
                onClick={() => setPickerSlot(slot)}
              />
            </div>
          );
        })}
      </LineupCourt>
      <PlayerPicker
        open={pickerSlot !== null}
        onOpenChange={(open) => {
          if (!open) setPickerSlot(null);
        }}
        title={pickerSlot ? `Choose ${pickerSlot}` : "Choose starter"}
        description="Pick who starts at this position."
        players={pickerSlot ? eligibleFor(pickerSlot) : []}
        currentPlayerId={pickerSlot ? currentFor(pickerSlot) : ""}
        onSelect={(playerId) => {
          if (pickerSlot) props.onChangeStarter(pickerSlot, playerId);
        }}
      />
    </section>
  );
}
