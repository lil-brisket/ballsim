"use client";

import { Button } from "@/components/ui/Button";
import { useMemo, useState } from "react";
import { updateLineupAndRotationAction } from "@/application/actions";
import { RotationTable } from "@/components/team-management/RotationTable";
import { StartingFiveEditor } from "@/components/team-management/StartingFiveEditor";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import type {
  LineupView,
  RotationView,
} from "@/state/team-management-selectors";
import {
  collectPlayerCards,
  createEditorState,
  setStarterSlot,
  toSavePayload,
  updateRotationRow,
  type EditableRotationRow,
  type LineupRotationEditorState,
} from "@/state/lineup-rotation-editor";

export function LineupRotationEditor(props: {
  saveId: string;
  lineup: LineupView;
  rotation: RotationView;
  portraits?: Record<string, PlayerPortraitAssignment | null>;
}) {
  const returnPath = `/dashboard/${props.saveId}/team-management/lineups`;
  const [state, setState] = useState(() =>
    createEditorState(props.lineup, props.rotation),
  );
  const [dirty, setDirty] = useState(false);

  const playerCards = useMemo(
    () => collectPlayerCards(props.lineup),
    [props.lineup],
  );
  // Merge display fields from rotation rows into card map for renamed players
  const allPlayers = useMemo(() => {
    const map = new Map(playerCards);
    for (const row of state.rows) {
      if (!map.has(row.playerId)) {
        map.set(row.playerId, {
          playerId: row.playerId,
          firstName: row.firstName,
          lastName: row.lastName,
          position: row.position,
          overall: row.overall ?? 0,
          plannedMinutes: row.targetMinutes,
          availabilityLabel: row.availabilityLabel,
          available: row.availabilityStatus === "available",
          role: row.groupRole,
        });
      }
    }
    return [...map.values()];
  }, [playerCards, state.rows]);

  const rowsById = useMemo(() => {
    const map = new Map<string, EditableRotationRow>();
    for (const row of state.rows) {
      map.set(row.playerId, row);
    }
    return map;
  }, [state.rows]);

  const markDirty = (next: LineupRotationEditorState) => {
    setState(next);
    setDirty(true);
  };

  const payload = toSavePayload(state);

  return (
    <div className="space-y-8">
      <StartingFiveEditor
        starters={state.starters}
        allPlayers={allPlayers}
        rowsById={rowsById}
        portraits={props.portraits}
        onChangeStarter={(slot, playerId) =>
          markDirty(setStarterSlot(state, slot, playerId))
        }
      />

      <RotationTable
        rows={state.rows}
        teamName={props.rotation.teamName}
        onUpdate={(playerId, patch) =>
          markDirty(updateRotationRow(state, playerId, patch))
        }
      />

      {dirty ? (
        <form
          action={updateLineupAndRotationAction}
          className="sticky bottom-0 z-10 border-t border-zinc-800 bg-zinc-950/95 py-3 backdrop-blur"
        >
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="teamId" value={props.rotation.teamId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <input
            type="hidden"
            name="startingLineupJson"
            value={JSON.stringify(payload.startingLineup)}
          />
          <input
            type="hidden"
            name="benchJson"
            value={JSON.stringify(payload.bench)}
          />
          <input
            type="hidden"
            name="inactiveJson"
            value={JSON.stringify(payload.inactive)}
          />
          <input
            type="hidden"
            name="rotationJson"
            value={JSON.stringify(payload.rotation)}
          />
          <input
            type="hidden"
            name="rotationStyle"
            value={payload.rotationStyle}
          />
          <input
            type="hidden"
            name="rotationPhilosophy"
            value={payload.rotationPhilosophy}
          />
          <input
            type="hidden"
            name="rotationDepth"
            value={String(payload.rotationDepth)}
          />
          <input
            type="hidden"
            name="rotationPreset"
            value={payload.rotationPreset}
          />
          <input
            type="hidden"
            name="closingLineupPolicy"
            value={payload.closingLineupPolicy}
          />
          <input
            type="hidden"
            name="closingLineupJson"
            value={JSON.stringify(payload.closingLineupIds)}
          />
          <Button type="submit" variant="primary">
            Save Changes
          </Button>
        </form>
      ) : null}
    </div>
  );
}
