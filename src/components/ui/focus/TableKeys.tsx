"use client";

import {
  nextRowControlIndex,
  nextSortIndex,
  ROW_CONTROL_SELECTOR,
} from "@/components/ui/focus/table-keys";

/** Class for wrapped tables that don't style the focused row themselves. */
export const tableRowFocusClass = "[&_tbody_tr:focus-within]:bg-surface-high";

const SORT_CONTROL_SELECTOR = "a[href], button:not([disabled])";

function controlsIn(row: Element): HTMLElement[] {
  return Array.from(row.querySelectorAll<HTMLElement>(ROW_CONTROL_SELECTOR));
}

function sortHeaders(table: HTMLTableElement): HTMLElement[] {
  const found: HTMLElement[] = [];
  table.querySelectorAll("thead th[aria-sort]").forEach((th) => {
    const control = th.querySelector<HTMLElement>(SORT_CONTROL_SELECTOR);
    if (control) found.push(control);
  });
  return found;
}

function sortedIndex(table: HTMLTableElement, count: number): number {
  const ths = Array.from(table.querySelectorAll("thead th[aria-sort]")).filter(
    (th) => th.querySelector(SORT_CONTROL_SELECTOR),
  );
  const index = ths.findIndex((th) => {
    const value = th.getAttribute("aria-sort");
    return value === "ascending" || value === "descending";
  });
  return index >= count ? -1 : index;
}

/**
 * Arrow-key movement for a data table: Up/Down step between rows (same
 * column control), Down from a sort header enters the first row, Left/Right
 * activate the neighbouring sortable header. Adds to Tab, never replaces it;
 * Enter stays the focused link/button's own behaviour.
 */
export function TableKeys(props: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const { key } = event;
    const vertical = key === "ArrowDown" || key === "ArrowUp";
    const horizontal = key === "ArrowLeft" || key === "ArrowRight";
    if (!vertical && !horizontal) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement;
    if (
      target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
    ) {
      return;
    }
    const table = target.closest("table");
    if (!table || !event.currentTarget.contains(table)) return;
    const row = target.closest("tr");
    if (!row) return;
    const inBody = row.parentElement?.tagName === "TBODY";
    const inHead = row.parentElement?.tagName === "THEAD";
    const rows = Array.from(
      table.querySelectorAll<HTMLTableRowElement>(":scope > tbody > tr"),
    );

    if (vertical) {
      const step = key === "ArrowDown" ? 1 : -1;
      if (inHead) {
        if (step !== 1) return;
        const first = rows.find((r) => controlsIn(r).length > 0);
        const control = first ? controlsIn(first)[0] : undefined;
        if (!control) return;
        event.preventDefault();
        control.focus();
        return;
      }
      if (!inBody) return;
      const rowIndex = rows.indexOf(row as HTMLTableRowElement);
      const controls = controlsIn(row);
      const controlIndex = Math.max(0, controls.indexOf(target));
      const counts = rows.map((r) => controlsIn(r).length);
      const next = nextRowControlIndex(counts, rowIndex, controlIndex, step);
      if (!next) return;
      const destination = controlsIn(rows[next.row]!)[next.control];
      if (!destination) return;
      event.preventDefault();
      destination.focus();
      return;
    }

    if (!inBody) return;
    const headers = sortHeaders(table);
    if (headers.length === 0) return;
    const step = key === "ArrowRight" ? 1 : -1;
    const next = nextSortIndex(
      headers.length,
      sortedIndex(table, headers.length),
      step,
    );
    event.preventDefault();
    if (next !== null) headers[next]!.click();
  }

  return (
    <div className={props.className} style={props.style} onKeyDown={onKeyDown}>
      {props.children}
    </div>
  );
}
