"use client";

import { cn, focusRingClass } from "@/components/ui/styles";
import { useRef, useState, useTransition, type DragEvent } from "react";
import {
  moveFantasyDraftTeamToIndexAction,
  reorderFantasyDraftAction,
  swapFantasyDraftTeamsAction,
} from "@/application/actions";

export type FantasyDraftOrderEntry = {
  pickNumber: number;
  teamId: string;
  teamName: string;
  isUser: boolean;
};

type FantasyDraftOrderEditorProps = {
  saveId: string;
  draftOrder: readonly FantasyDraftOrderEntry[];
};

export function FantasyDraftOrderEditor(props: FantasyDraftOrderEditorProps) {
  const { saveId } = props;
  const [entries, setEntries] = useState(() => [...props.draftOrder]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [dragTeamId, setDragTeamId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [orderSource, setOrderSource] = useState(props.draftOrder);
  const [pending, startTransition] = useTransition();
  const suppressClickRef = useRef(false);

  if (props.draftOrder !== orderSource) {
    setOrderSource(props.draftOrder);
    setEntries([...props.draftOrder]);
    setSelectedTeamId(null);
    setDragTeamId(null);
    setDropTargetIndex(null);
  }

  function submitMoveToIndex(teamId: string, toIndex: number) {
    const formData = new FormData();
    formData.set("saveId", saveId);
    formData.set("teamId", teamId);
    formData.set("toIndex", String(toIndex));
    startTransition(() => {
      void moveFantasyDraftTeamToIndexAction(formData);
    });
  }

  function submitSwap(teamIdA: string, teamIdB: string) {
    const formData = new FormData();
    formData.set("saveId", saveId);
    formData.set("teamIdA", teamIdA);
    formData.set("teamIdB", teamIdB);
    startTransition(() => {
      void swapFantasyDraftTeamsAction(formData);
    });
  }

  function submitStep(teamId: string, direction: -1 | 1) {
    const formData = new FormData();
    formData.set("saveId", saveId);
    formData.set("teamId", teamId);
    formData.set("direction", String(direction));
    startTransition(() => {
      void reorderFantasyDraftAction(formData);
    });
  }

  function onRowActivate(teamId: string) {
    if (pending || suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (selectedTeamId === null) {
      setSelectedTeamId(teamId);
      return;
    }
    if (selectedTeamId === teamId) {
      setSelectedTeamId(null);
      return;
    }
    const fromIndex = entries.findIndex(
      (entry) => entry.teamId === selectedTeamId,
    );
    const toIndex = entries.findIndex((entry) => entry.teamId === teamId);
    if (fromIndex < 0 || toIndex < 0) {
      setSelectedTeamId(null);
      return;
    }
    const next = [...entries];
    const tmp = next[fromIndex]!;
    next[fromIndex] = next[toIndex]!;
    next[toIndex] = tmp;
    setEntries(next);
    setSelectedTeamId(null);
    submitSwap(selectedTeamId, teamId);
  }

  function onDragStart(event: DragEvent, teamId: string) {
    if (pending) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", teamId);
    setSelectedTeamId(null);
    setDragTeamId(teamId);
  }

  function onDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragTeamId === null) {
      return;
    }
    setDropTargetIndex(index);
  }

  function onDrop(event: DragEvent, toIndex: number) {
    event.preventDefault();
    const movingTeamId =
      dragTeamId ?? event.dataTransfer.getData("text/plain") ?? null;
    setDragTeamId(null);
    setDropTargetIndex(null);
    suppressClickRef.current = true;
    if (movingTeamId === null || pending) {
      return;
    }
    const fromIndex = entries.findIndex(
      (entry) => entry.teamId === movingTeamId,
    );
    if (fromIndex < 0 || fromIndex === toIndex) {
      return;
    }
    const next = [...entries];
    const [moved] = next.splice(fromIndex, 1);
    if (moved === undefined) {
      return;
    }
    next.splice(toIndex, 0, moved);
    setEntries(next);
    submitMoveToIndex(movingTeamId, toIndex);
  }

  function onDragEnd() {
    setDragTeamId(null);
    setDropTargetIndex(null);
    suppressClickRef.current = true;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Drag a row to move it, or click two teams to swap. Arrow buttons still
        nudge one step.
      </p>
      {selectedTeamId !== null ? (
        <p className="text-sm text-team-ink/90" role="status">
          Selected for swap — click another team, or click again to cancel.
        </p>
      ) : null}
      <ol className="space-y-2">
        {entries.map((entry, index) => {
          const isSelected = selectedTeamId === entry.teamId;
          const isDragging = dragTeamId === entry.teamId;
          const isDropTarget =
            dropTargetIndex === index &&
            dragTeamId !== null &&
            dragTeamId !== entry.teamId;
          return (
            <li
              key={entry.teamId}
              draggable={!pending}
              onDragStart={(event) => onDragStart(event, entry.teamId)}
              onDragOver={(event) => onDragOver(event, index)}
              onDrop={(event) => onDrop(event, index)}
              onDragEnd={onDragEnd}
              onClick={() => onRowActivate(entry.teamId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowActivate(entry.teamId);
                }
              }}
              role="button"
              tabIndex={pending ? -1 : 0}
              aria-pressed={isSelected}
              aria-label={
                isSelected
                  ? `Cancel swap for ${entry.teamName}`
                  : selectedTeamId === null
                    ? `Select ${entry.teamName} to swap`
                    : `Swap with ${entry.teamName}`
              }
              className={[
                "flex items-center justify-between rounded-lg border px-3 py-2 transition-colors",
                isSelected
                  ? "border-team-ink bg-team/20"
                  : isDropTarget
                    ? "border-team-ink/80 bg-surface-raised"
                    : "border-line hover:border-disabled",
                isDragging ? "opacity-50" : "",
                pending
                  ? "pointer-events-none opacity-70"
                  : "cursor-grab active:cursor-grabbing",
              ].join(" ")}
            >
              <span className="flex min-w-0 flex-1 items-center text-sm text-ink">
                <span
                  className="mr-2 select-none text-disabled"
                  aria-hidden="true"
                  title="Drag to reorder"
                >
                  ⠿
                </span>
                <span className="mr-3 tabular-nums text-faint">
                  {index + 1}.
                </span>
                <span className="truncate">{entry.teamName}</span>
                {entry.isUser ? (
                  <span className="ml-2 shrink-0 rounded bg-team/20 px-1.5 py-0.5 text-sm text-team-ink">
                    USER
                  </span>
                ) : (
                  <span className="ml-2 shrink-0 rounded bg-surface-high px-1.5 py-0.5 text-sm text-muted">
                    CPU
                  </span>
                )}
              </span>
              <span
                className="ml-2 flex shrink-0 gap-1"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  disabled={pending || index === 0}
                  onClick={() => submitStep(entry.teamId, -1)}
                  className={cn(
                    "min-h-11 min-w-11 touch-manipulation rounded border border-line-strong px-2 py-1 text-sm text-soft disabled:opacity-40",
                    focusRingClass,
                  )}
                  aria-label={`Move ${entry.teamName} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={pending || index === entries.length - 1}
                  onClick={() => submitStep(entry.teamId, 1)}
                  className={cn(
                    "min-h-11 min-w-11 touch-manipulation rounded border border-line-strong px-2 py-1 text-sm text-soft disabled:opacity-40",
                    focusRingClass,
                  )}
                  aria-label={`Move ${entry.teamName} down`}
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
