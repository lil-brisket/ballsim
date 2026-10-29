"use client";

import { useEffect, useRef } from "react";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { BestMarker, RatingCell } from "@/components/roster/sheet/RatingCell";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { RatingDisplayMode } from "@/presentation/rating-grade";
import { formatSheetStat } from "@/presentation/roster-sheet-columns";
import type {
  SheetColumn,
  SheetGroup,
  SheetSort,
} from "@/presentation/roster-sheet-model";
import type { RosterPagePlayerView } from "@/state/roster-page-selectors";

export function sheetRowId(playerId: string): string {
  return `sheet-row-${playerId}`;
}

/** Rating columns shown as plain numbers whatever the grade/rating display. */
const PLAIN_RATING_IDS = new Set(["ovr", "pot"]);

function ariaSort(
  sort: SheetSort,
  columnId: string,
): "ascending" | "descending" | "none" {
  if (sort.columnId !== columnId) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

function SortHeader(props: {
  id: string;
  short: string;
  long: string;
  sort: SheetSort;
  align: "left" | "right";
  sticky?: boolean;
  onSort: (columnId: string) => void;
}) {
  const sorted = props.sort.columnId === props.id;
  return (
    <th
      scope="col"
      aria-sort={ariaSort(props.sort, props.id)}
      className={cn(
        "whitespace-nowrap border-b border-surface-line p-0 font-display text-sm font-semibold uppercase tracking-wide",
        sorted ? "bg-surface-high text-ink" : "bg-surface-raised text-muted",
        props.sticky && "sticky left-0 z-20",
      )}
    >
      <button
        type="button"
        title={props.long}
        onClick={() => props.onSort(props.id)}
        className={cn(
          "inline-flex min-h-11 w-full items-center gap-1 px-2 touch-manipulation hover:text-ink",
          props.align === "right" ? "justify-end" : "justify-start",
          focusRingClass,
        )}
      >
        {props.short}
        <span aria-hidden className="inline-block w-3 text-sm">
          {sorted ? (props.sort.direction === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );
}

function Cell(props: {
  column: SheetColumn;
  player: RosterPagePlayerView;
  best: boolean;
  mode: RatingDisplayMode;
}) {
  const { column, player } = props;
  const value = column.get(player);
  if (value === null) return <>—</>;
  if (column.kind === "rating" && typeof value === "number") {
    return (
      <RatingCell
        value={value}
        mode={props.mode}
        best={props.best}
        plain={PLAIN_RATING_IDS.has(column.id)}
      />
    );
  }
  if (column.kind === "stat" && typeof value === "number") {
    return (
      <span className="inline-flex items-center justify-end gap-1">
        {props.best ? <BestMarker /> : null}
        <span>{formatSheetStat(value)}</span>
        {props.best ? <span className="sr-only">best on team</span> : null}
      </span>
    );
  }
  return <>{value}</>;
}

/**
 * The roster sheet grid. Rows select on click (never navigate) and open the
 * player card on double-click. Keyboard handling is the parent's, on the
 * focused grid. The scroll container scrolls sideways so the page never does;
 * the name column stays put.
 */
export function SheetTable(props: {
  columns: readonly SheetColumn[];
  groups: readonly SheetGroup[];
  selectedId: string | null;
  onSelect: (playerId: string) => void;
  onOpen: (playerId: string) => void;
  sort: SheetSort;
  onSort: (columnId: string) => void;
  bests: Map<string, Set<string>>;
  mode: RatingDisplayMode;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTableElement>) => void;
}) {
  const gridRef = useRef<HTMLTableElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    // Keep the selected row visible, but never move the page on first paint.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!props.selectedId) return;
    const row = gridRef.current?.querySelector<HTMLElement>(
      `[data-player-id="${props.selectedId}"]`,
    );
    row?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [props.selectedId]);

  const span = props.columns.length + 1;

  return (
    <div className="relative max-w-full overflow-x-auto rounded-lg border border-surface-line">
      <table
        ref={gridRef}
        role="grid"
        tabIndex={0}
        aria-label="Roster sheet"
        aria-activedescendant={
          props.selectedId ? sheetRowId(props.selectedId) : undefined
        }
        onKeyDown={props.onKeyDown}
        className={cn(
          "w-full border-separate border-spacing-0 text-sm",
          focusRingClass,
        )}
      >
        <thead>
          <tr>
            <SortHeader
              id="name"
              short="Player"
              long="Player name"
              sort={props.sort}
              align="left"
              sticky
              onSort={props.onSort}
            />
            {props.columns.map((column) => (
              <SortHeader
                key={column.id}
                id={column.id}
                short={column.short}
                long={column.long}
                sort={props.sort}
                align={column.kind === "text" ? "left" : "right"}
                onSort={props.onSort}
              />
            ))}
          </tr>
        </thead>
        {props.groups.map((group) => (
          <tbody key={group.id}>
            {group.label !== null ? (
              <tr>
                <th
                  colSpan={span}
                  scope="rowgroup"
                  className="bg-surface-deep px-3 py-1.5 text-left font-display text-sm font-semibold uppercase tracking-wide text-muted"
                >
                  {group.label}
                </th>
              </tr>
            ) : null}
            {group.rows.map((player) => {
              const selected = player.playerId === props.selectedId;
              return (
                <tr
                  key={player.playerId}
                  id={sheetRowId(player.playerId)}
                  role="row"
                  data-player-id={player.playerId}
                  aria-selected={selected}
                  onClick={() => {
                    props.onSelect(player.playerId);
                    gridRef.current?.focus({ preventScroll: true });
                  }}
                  onDoubleClick={() => props.onOpen(player.playerId)}
                  className={cn(
                    "cursor-pointer",
                    !player.canPlay && "opacity-70",
                  )}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-10 h-11 min-w-48 whitespace-nowrap border-b border-l-4 border-b-surface-line px-2",
                      selected
                        ? "border-l-team bg-surface-high"
                        : "border-l-transparent bg-surface-raised",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <PlayerPortrait
                        playerId={player.playerId}
                        portrait={player.portrait}
                        firstName={player.firstName}
                        lastName={player.lastName}
                        size="sm"
                      />
                      <span className="font-mono tabular-nums text-soft">
                        {player.jerseyNumber}
                      </span>
                      <span className="font-semibold text-ink">
                        {player.firstName} {player.lastName}
                      </span>
                      {!player.canPlay ? (
                        <StatusBadge
                          label={player.availabilityLabel}
                          tone={player.injuryKind}
                        />
                      ) : null}
                    </span>
                  </td>
                  {props.columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        "h-11 whitespace-nowrap border-b border-surface-line px-2 tabular-nums text-soft",
                        column.kind === "text" ? "text-left" : "text-right",
                        selected
                          ? "bg-team/20"
                          : props.sort.columnId === column.id &&
                              "bg-surface-high/40",
                      )}
                    >
                      <Cell
                        column={column}
                        player={player}
                        best={
                          props.bests.get(column.id)?.has(player.playerId) ??
                          false
                        }
                        mode={props.mode}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
