"use client";

import { useMemo, useState } from "react";
import { useEntityDrawer } from "@/components/entity/EntityDrawerProvider";
import { SheetHeader } from "@/components/roster/sheet/SheetHeader";
import { SheetTable } from "@/components/roster/sheet/SheetTable";
import { KeyHint } from "@/components/ui/KeyHint";
import { SlantTabs } from "@/components/ui/Tabs";
import { RatingDisplaySwitch } from "@/components/ui/RatingDisplaySwitch";
import { useRatingDisplay } from "@/components/ui/rating-display";
import {
  bestInColumn,
  DEFAULT_SHEET_SORT,
  groupSheetRows,
  moveSortColumn,
  sheetColumns,
  sortSheetRows,
  type SheetSort,
  type SheetTab,
} from "@/presentation/roster-sheet-model";
import type { RosterPagePlayerView } from "@/state/roster-page-selectors";

const TABS: ReadonlyArray<{ id: SheetTab; label: string }> = [
  { id: "simple", label: "Simple" },
  { id: "detail", label: "Detail" },
  { id: "stats", label: "Stats" },
];

/** Skill, stat and rating columns sort best-first; text and age ascending. */
function firstDirection(kind: string | undefined): SheetSort["direction"] {
  return kind === "rating" || kind === "stat" ? "desc" : "asc";
}

/**
 * The roster as a sortable sheet (Simple / Detail / Stats) with the selected
 * player summarised above it. Keys act only while the grid is focused:
 * Up/Down select, Left/Right move the sort column, Enter opens the card,
 * [ and ] switch tabs, Home/End jump to the first or last row.
 */
export function RosterSheet(props: {
  saveId: string;
  players: RosterPagePlayerView[];
  returnPath: string;
}) {
  const { openPlayer } = useEntityDrawer();
  const [mode] = useRatingDisplay();
  const [tab, setTab] = useState<SheetTab>("simple");
  const [sortState, setSortState] = useState<SheetSort>(DEFAULT_SHEET_SORT);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const columns = sheetColumns(tab);
  // A sort on a column the current tab lacks falls back to the default order.
  const sort: SheetSort =
    sortState.columnId === "default" ||
    sortState.columnId === "name" ||
    columns.some((column) => column.id === sortState.columnId)
      ? sortState
      : DEFAULT_SHEET_SORT;

  const sorted = useMemo(
    () => sortSheetRows(props.players, columns, sort),
    [props.players, columns, sort],
  );
  const groups = useMemo(() => groupSheetRows(sorted, sort), [sorted, sort]);
  const bests = useMemo(
    () => bestInColumn(props.players, columns),
    [props.players, columns],
  );

  // The first row of the default order until the user picks; if the pick
  // leaves the roster, fall back to the first row again.
  const selected =
    props.players.find((player) => player.playerId === selectedState) ??
    sortSheetRows(props.players, columns, DEFAULT_SHEET_SORT)[0] ??
    null;

  function applySort(columnId: string, direction: SheetSort["direction"]) {
    setSortState({ columnId, direction });
  }

  function onSort(columnId: string) {
    if (sort.columnId === columnId) {
      applySort(columnId, sort.direction === "asc" ? "desc" : "asc");
      return;
    }
    const kind = columns.find((column) => column.id === columnId)?.kind;
    applySort(columnId, firstDirection(kind));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTableElement>) {
    // Only the grid itself: header buttons keep their own Enter/Space.
    if (event.target !== event.currentTarget) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const order = sorted;
    const index = order.findIndex(
      (player) => player.playerId === selected?.playerId,
    );
    const pick = (next: number) => {
      const player = order[Math.min(order.length - 1, Math.max(0, next))];
      if (player) setSelectedState(player.playerId);
    };

    switch (event.key) {
      case "ArrowDown":
        pick(index + 1);
        break;
      case "ArrowUp":
        pick(index - 1);
        break;
      case "Home":
        pick(0);
        break;
      case "End":
        pick(order.length - 1);
        break;
      case "ArrowRight":
      case "ArrowLeft": {
        const next = moveSortColumn(
          columns,
          sort,
          event.key === "ArrowRight" ? 1 : -1,
        );
        const kind = columns.find((column) => column.id === next)?.kind;
        applySort(next, firstDirection(kind));
        break;
      }
      case "Enter":
        if (selected) openPlayer(selected.playerId);
        break;
      case "[":
      case "]": {
        const at = TABS.findIndex((entry) => entry.id === tab);
        const delta = event.key === "]" ? 1 : -1;
        setTab(TABS[(at + delta + TABS.length) % TABS.length]!.id);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SlantTabs
          aria-label="Sheet tabs"
          activeKey={tab}
          items={TABS.map((entry) => ({
            key: entry.id,
            label: entry.label,
            onSelect: () => setTab(entry.id),
          }))}
        />
        <RatingDisplaySwitch />
      </div>

      {selected ? (
        <SheetHeader
          saveId={props.saveId}
          player={selected}
          returnPath={props.returnPath}
          mode={mode}
        />
      ) : null}

      <SheetTable
        columns={columns}
        groups={groups}
        selectedId={selected?.playerId ?? null}
        onSelect={setSelectedState}
        onOpen={(playerId) => openPlayer(playerId)}
        sort={sort}
        onSort={onSort}
        bests={bests}
        mode={mode}
        onKeyDown={onKeyDown}
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <KeyHint keys={["↑", "↓"]} label="Select" />
        <KeyHint keys={["←", "→"]} label="Sort" />
        <KeyHint keys="Enter" label="Player card" />
        <KeyHint keys={["[", "]"]} label="Tabs" />
      </div>
    </div>
  );
}
