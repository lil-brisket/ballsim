"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { useEntityDrawer } from "@/components/entity/EntityDrawerProvider";
import { ProspectSheetHeader } from "@/components/roster/sheet/ProspectSheetHeader";
import { RatingRangeCell } from "@/components/roster/sheet/RatingRangeCell";
import { SheetTable } from "@/components/roster/sheet/SheetTable";
import { KeyHint } from "@/components/ui/KeyHint";
import { RatingDisplaySwitch } from "@/components/ui/RatingDisplaySwitch";
import { useRatingDisplay } from "@/components/ui/rating-display";
import {
  DEFAULT_SHEET_SORT,
  moveSortColumn,
  PROSPECT_COLUMNS,
  sortProspectRows,
  ungroupedProspects,
  type ProspectColumn,
} from "@/presentation/prospect-sheet-model";
import type { RatingDisplayMode } from "@/presentation/rating-grade";
import type { SheetSort } from "@/presentation/roster-sheet-model";
import type { ProspectSheetRow } from "@/state/prospect-sheet-view";

function ProspectName(props: { prospect: ProspectSheetRow }) {
  const { prospect } = props;
  return (
    <span className="flex items-center gap-2">
      <PlayerPortrait
        playerId={prospect.playerId}
        portrait={prospect.portrait}
        firstName={prospect.firstName}
        lastName={prospect.lastName}
        size="sm"
      />
      <span className="font-semibold text-ink">
        {prospect.firstName} {prospect.lastName}
      </span>
    </span>
  );
}

function ProspectCell(props: {
  column: ProspectColumn;
  prospect: ProspectSheetRow;
  mode: RatingDisplayMode;
}) {
  const { column } = props;
  const value = column.get(props.prospect);
  if (value === null) return <>—</>;
  if (typeof value === "object") {
    return (
      <RatingRangeCell range={value} mode={props.mode} plain={column.plain} />
    );
  }
  if (column.id === "conf") return <span className="capitalize">{value}</span>;
  return <>{value}</>;
}

function firstDirection(columnId: string): SheetSort["direction"] {
  return (
    PROSPECT_COLUMNS.find((column) => column.id === columnId)?.firstDirection ??
    "asc"
  );
}

/**
 * The draft prospect pool as a sortable scouting sheet with the selected
 * prospect summarised above it. Rows hold scouting estimates only. Keys act
 * only while the grid is focused: Up/Down select, Left/Right move the sort
 * column, Enter opens the card, Home/End jump to the first or last row.
 * `actionsById` holds the server-built draft and add-to-board forms.
 */
export function ProspectSheet(props: {
  rows: ProspectSheetRow[];
  /** Every eligible prospect, for the "Showing N of M" footnote. */
  total: number;
  actionsById: Record<string, ReactNode>;
  label?: string;
}) {
  const { openPlayer } = useEntityDrawer();
  const [mode] = useRatingDisplay();
  const [sort, setSort] = useState<SheetSort>(DEFAULT_SHEET_SORT);
  const [selectedState, setSelectedState] = useState<string | null>(null);

  const sorted = useMemo(
    () => sortProspectRows(props.rows, PROSPECT_COLUMNS, sort),
    [props.rows, sort],
  );
  const groups = useMemo(() => ungroupedProspects(sorted), [sorted]);

  // The first row of the page order until the user picks; if the pick leaves
  // the pool, fall back to the first row again.
  const selected =
    props.rows.find((row) => row.playerId === selectedState) ??
    props.rows[0] ??
    null;

  function onSort(columnId: string) {
    if (sort.columnId === columnId) {
      setSort({
        columnId,
        direction: sort.direction === "asc" ? "desc" : "asc",
      });
      return;
    }
    setSort({ columnId, direction: firstDirection(columnId) });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTableElement>) {
    // Only the grid itself: header buttons keep their own Enter/Space.
    if (event.target !== event.currentTarget) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const index = sorted.findIndex(
      (row) => row.playerId === selected?.playerId,
    );
    const pick = (next: number) => {
      const row = sorted[Math.min(sorted.length - 1, Math.max(0, next))];
      if (row) setSelectedState(row.playerId);
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
        pick(sorted.length - 1);
        break;
      case "ArrowRight":
      case "ArrowLeft": {
        const next = moveSortColumn(
          PROSPECT_COLUMNS,
          sort,
          event.key === "ArrowRight" ? 1 : -1,
        );
        setSort({ columnId: next, direction: firstDirection(next) });
        break;
      }
      case "Enter":
        if (selected) openPlayer(selected.playerId);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Scouting estimates only. Ranges narrow as you scout.
        </p>
        <RatingDisplaySwitch />
      </div>

      {selected ? (
        <ProspectSheetHeader
          prospect={selected}
          actions={props.actionsById[selected.playerId]}
        />
      ) : null}

      <SheetTable
        columns={PROSPECT_COLUMNS}
        groups={groups}
        selectedId={selected?.playerId ?? null}
        onSelect={setSelectedState}
        onOpen={(playerId) => openPlayer(playerId)}
        sort={sort}
        onSort={onSort}
        renderName={(prospect) => <ProspectName prospect={prospect} />}
        renderCell={(column, prospect) => (
          <ProspectCell column={column} prospect={prospect} mode={mode} />
        )}
        nameHeader={{ short: "Prospect", long: "Prospect name" }}
        label={props.label ?? "Prospect pool sheet"}
        onKeyDown={onKeyDown}
      />

      {props.total > props.rows.length ? (
        <p className="text-sm text-muted">
          Showing {props.rows.length} of {props.total} prospects, best scouted
          first.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <KeyHint keys={["↑", "↓"]} label="Select" />
        <KeyHint keys={["←", "→"]} label="Sort" />
        <KeyHint keys="Enter" label="Player card" />
      </div>
    </div>
  );
}
