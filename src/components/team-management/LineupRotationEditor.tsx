"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  previewOptimizeRotationAction,
  updateLineupAndRotationAction,
} from "@/application/actions";
import { BenchEditor } from "@/components/team-management/BenchEditor";
import { ClosingLineupEditor } from "@/components/team-management/ClosingLineupEditor";
import { RotationHealth } from "@/components/team-management/RotationHealth";
import { RotationSettings } from "@/components/team-management/RotationSettings";
import { RotationTable } from "@/components/team-management/RotationTable";
import { StartingFiveEditor } from "@/components/team-management/StartingFiveEditor";
import type { LineupView, RotationView } from "@/state/team-management-selectors";
import {
  applyOptimizedManagement,
  buildOptimizeChangelog,
  cloneEditorState,
  collectPlayerCards,
  createEditorState,
  moveBenchToInactive,
  moveInactiveToBench,
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
}) {
  const returnPath = `/dashboard/${props.saveId}/team-management/lineups`;
  const initialRef = useRef(createEditorState(props.lineup, props.rotation));
  const [undoSnapshot, setUndoSnapshot] =
    useState<LineupRotationEditorState | null>(null);
  const [state, setState] = useState(() =>
    createEditorState(props.lineup, props.rotation),
  );
  const [dirty, setDirty] = useState(false);
  const [optimizeChangelog, setOptimizeChangelog] = useState<string[] | null>(
    null,
  );
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [optimizing, startOptimize] = useTransition();

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

  const editableRows = state.rows.filter((row) => row.groupRole !== "inactive");
  const localTotalMinutes = editableRows.reduce(
    (sum, row) => sum + row.targetMinutes,
    0,
  );
  const localMeaningfulCount = editableRows.filter(
    (row) => row.targetMinutes > 0,
  ).length;

  const markDirty = (next: LineupRotationEditorState) => {
    setState(next);
    setDirty(true);
    setOptimizeChangelog(null);
    setOptimizeError(null);
  };

  const handleOptimize = () => {
    setOptimizeError(null);
    startOptimize(async () => {
      const snapshot = cloneEditorState(state);
      const payload = toSavePayload(state);
      const formData = new FormData();
      formData.set("saveId", props.saveId);
      formData.set("teamId", props.rotation.teamId);
      formData.set("startingLineupJson", JSON.stringify(payload.startingLineup));
      formData.set("benchJson", JSON.stringify(payload.bench));
      formData.set("inactiveJson", JSON.stringify(payload.inactive));
      formData.set("rotationJson", JSON.stringify(payload.rotation));
      formData.set("rotationStyle", payload.rotationStyle);
      formData.set("rotationPhilosophy", payload.rotationPhilosophy);
      formData.set("rotationDepth", String(payload.rotationDepth));
      formData.set("rotationPreset", payload.rotationPreset);
      formData.set("closingLineupPolicy", payload.closingLineupPolicy);
      formData.set(
        "closingLineupJson",
        JSON.stringify(payload.closingLineupIds),
      );

      const result = await previewOptimizeRotationAction(formData);
      if (!result.ok) {
        setOptimizeError(result.error);
        return;
      }

      setUndoSnapshot(snapshot);
      const next = applyOptimizedManagement(state, {
        startingLineup: result.management.startingLineup.map((s) => ({
          playerId: s.playerId,
          slot: s.slot,
        })),
        bench: result.management.bench.map(String),
        inactive: result.management.inactive.map(String),
        rotation: result.management.rotation.map((entry) => ({
          playerId: entry.playerId,
          targetMinutes: entry.targetMinutes,
          rotationPriority: entry.rotationPriority,
          rotationStatus: entry.rotationStatus,
          role: entry.role,
          preferredPositions: entry.preferredPositions.map(String),
          secondaryPositions: entry.secondaryPositions.map(String),
          minutePriorityBias: entry.minutePriorityBias,
          overrideMedicalRecommendation: entry.overrideMedicalRecommendation,
        })),
        rotationPreset: result.management.rotationPreset,
        closingLineupPolicy: result.management.closingLineupPolicy,
        closingLineupIds: result.management.closingLineupIds.map(String),
        rotationStyle: result.management.rotationStyle,
        rotationPhilosophy: result.management.rotationPhilosophy,
        rotationDepth: result.management.rotationDepth,
      });
      setState(next);
      setDirty(true);
      const lines = buildOptimizeChangelog(snapshot.rows, next.rows);
      const fromServer = result.changelog.slice(0, 8).map((c) => c.message);
      setOptimizeChangelog(
        lines.length > 0
          ? ["Optimize applied — review targets.", ...lines]
          : fromServer.length > 0
            ? ["Optimize applied — review targets.", ...fromServer]
            : ["Optimize applied — review targets."],
      );
    });
  };

  const handleUndo = () => {
    const snapshot = undoSnapshot ?? initialRef.current;
    setState(cloneEditorState(snapshot));
    setUndoSnapshot(null);
    setOptimizeChangelog(null);
    setOptimizeError(null);
    const initial = initialRef.current;
    const restored = snapshot;
    setDirty(
      JSON.stringify(toSavePayload(restored)) !==
        JSON.stringify(toSavePayload(initial)),
    );
  };

  const payload = toSavePayload(state);

  return (
    <div className="space-y-8">
      <StartingFiveEditor
        starters={state.starters}
        allPlayers={allPlayers}
        rowsById={rowsById}
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

      <BenchEditor
        bench={state.bench}
        inactive={state.inactive}
        allPlayers={allPlayers}
        rowsById={rowsById}
        onMoveToInactive={(playerId) =>
          markDirty(moveBenchToInactive(state, playerId))
        }
        onMoveToBench={(playerId) =>
          markDirty(moveInactiveToBench(state, playerId))
        }
      />

      <RotationSettings
        preset={state.preset}
        optimizing={optimizing}
        canUndo={undoSnapshot != null || dirty}
        onPresetChange={(preset) =>
          markDirty({ ...state, preset })
        }
        onOptimize={handleOptimize}
        onUndo={handleUndo}
      />

      {optimizeError ? (
        <p className="text-sm text-rose-300">{optimizeError}</p>
      ) : null}

      {optimizeChangelog != null && optimizeChangelog.length > 0 ? (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-medium text-amber-200">
                Optimize summary
              </h3>
              <ul className="mt-2 space-y-1 text-xs text-zinc-300">
                {optimizeChangelog.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-zinc-500">
                Undo restores local edits — Save Changes to persist.
              </p>
            </div>
            <button
              type="button"
              onClick={handleUndo}
              className="shrink-0 rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Undo
            </button>
          </div>
        </div>
      ) : null}

      <RotationHealth
        rotation={props.rotation}
        localTotalMinutes={localTotalMinutes}
        localMeaningfulCount={localMeaningfulCount}
      />

      <ClosingLineupEditor
        closingPolicy={state.closingPolicy}
        closingIds={state.closingIds}
        editableRows={editableRows}
        onPolicyChange={(closingPolicy) =>
          markDirty({ ...state, closingPolicy, preset: "custom" })
        }
        onTogglePlayer={(playerId) => {
          markDirty({
            ...state,
            preset: "custom",
            closingIds: (() => {
              if (state.closingIds.includes(playerId)) {
                return state.closingIds.filter((id) => id !== playerId);
              }
              if (state.closingIds.length >= 5) {
                return state.closingIds;
              }
              return [...state.closingIds, playerId];
            })(),
          });
        }}
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
          <button
            type="submit"
            className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
          >
            Save Changes
          </button>
        </form>
      ) : null}
    </div>
  );
}
