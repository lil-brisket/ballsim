"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { SheetGroup, SheetSort } from "@/presentation/roster-sheet-model";

export function sheetRowId(playerId: string): string {
  return `sheet-row-${playerId}`;
}

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

/** What the grid needs of a row: an id; the callers render the rest. */
export type SheetRowBase = { playerId: string };

/** What the grid needs of a column: header text and an alignment kind. */
export type SheetColumnBase = {
  id: string;
  short: string;
  long: string;
  /** "text" columns align left, every other kind right. */
  kind: string;
};

/**
 * The sheet grid shared by the roster and prospect sheets, generic over the
 * row and column types. Rows select on click (never navigate) and open the
 * player card on double-click. Keyboard handling is the parent's, on the
 * focused grid. The scroll container scrolls sideways so the page never does;
 * the name column stays put. The caller renders the name cell and each data
 * cell, so this holds no roster- or scouting-specific knowledge.
 */
export function SheetTable<
  Row extends SheetRowBase,
  Column extends SheetColumnBase,
>(props: {
  columns: readonly Column[];
  groups: readonly SheetGroup<Row>[];
  selectedId: string | null;
  onSelect: (playerId: string) => void;
  /** Double-click action; omit when the rows have no card to open. */
  onOpen?: (playerId: string) => void;
  sort: SheetSort;
  onSort: (columnId: string) => void;
  renderName: (row: Row) => ReactNode;
  renderCell: (column: Column, row: Row) => ReactNode;
  /** Extra classes for a row (the roster dims unavailable players). */
  rowClassName?: (row: Row) => string | undefined;
  label?: string;
  /** Header of the name column; defaults to "Player". */
  nameHeader?: { short: string; long: string };
  onKeyDown?: (event: React.KeyboardEvent<HTMLTableElement>) => void;
}) {
  const gridRef = useRef<HTMLTableElement>(null);
  const firstRender = useRef(true);
  const nameHeader = props.nameHeader ?? {
    short: "Player",
    long: "Player name",
  };

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
        aria-label={props.label ?? "Roster sheet"}
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
              short={nameHeader.short}
              long={nameHeader.long}
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
            {group.rows.map((row) => {
              const selected = row.playerId === props.selectedId;
              return (
                <tr
                  key={row.playerId}
                  id={sheetRowId(row.playerId)}
                  role="row"
                  data-player-id={row.playerId}
                  aria-selected={selected}
                  onClick={() => {
                    props.onSelect(row.playerId);
                    gridRef.current?.focus({ preventScroll: true });
                  }}
                  onDoubleClick={() => props.onOpen?.(row.playerId)}
                  className={cn("cursor-pointer", props.rowClassName?.(row))}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-10 h-11 min-w-48 whitespace-nowrap border-b border-l-4 border-b-surface-line px-2",
                      selected
                        ? "border-l-team bg-surface-high"
                        : "border-l-transparent bg-surface-raised",
                    )}
                  >
                    {props.renderName(row)}
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
                      {props.renderCell(column, row)}
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
