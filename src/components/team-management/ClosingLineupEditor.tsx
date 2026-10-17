"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { Select } from "@/components/ui/Select";
import { PlayerChip } from "@/components/team-management/PlayerChip";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import type { EditableRotationRow } from "@/state/lineup-rotation-editor";

export function ClosingLineupEditor(props: {
  closingPolicy: string;
  closingIds: string[];
  editableRows: EditableRotationRow[];
  onPolicyChange: (policy: string) => void;
  onTogglePlayer: (playerId: string) => void;
  portraits?: Record<string, PlayerPortraitAssignment | null>;
}) {
  return (
    <section className="space-y-3">
      <SectionHeading title="Closing Lineup" />
      <label className="text-sm text-zinc-400">
        Policy
        <Select
          value={props.closingPolicy}
          onChange={(event) => props.onPolicyChange(event.target.value)}
          wrapperClassName="ml-2"
        >
          <option value="auto">Auto</option>
          <option value="best_five">Best Five</option>
          <option value="starters">Starters</option>
          <option value="custom">Custom</option>
        </Select>
      </label>
      {props.closingPolicy === "custom" ? (
        <div className="space-y-2 text-sm text-zinc-300">
          <p className="text-sm text-zinc-400">
            Select up to 5 closing players ({props.closingIds.length}/5)
          </p>
          <ul className="flex flex-wrap gap-3">
            {props.editableRows.map((row) => {
              const selected = props.closingIds.includes(row.playerId);
              return (
                <li key={row.playerId}>
                  <PlayerChip
                    player={row}
                    portrait={props.portraits?.[row.playerId]}
                    slotLabel={row.position}
                    pressed={selected}
                    onClick={() => props.onTogglePlayer(row.playerId)}
                    aria-label={`${row.firstName} ${row.lastName}, ${row.position}, overall ${row.overall ?? "unknown"}, ${row.availabilityLabel}`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
