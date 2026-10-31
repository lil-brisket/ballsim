"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useEntityDrawer } from "@/components/entity/EntityDrawerProvider";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { BestMarker, RatingCell } from "@/components/roster/sheet/RatingCell";
import { SheetHeader } from "@/components/roster/sheet/SheetHeader";
import { SheetTable } from "@/components/roster/sheet/SheetTable";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KeyHint } from "@/components/ui/KeyHint";
import { SlantTabs } from "@/components/ui/Tabs";
import { RatingDisplaySwitch } from "@/components/ui/RatingDisplaySwitch";
import { useRatingDisplay } from "@/components/ui/rating-display";
import type { RatingDisplayMode } from "@/presentation/rating-grade";
import { compareHref } from "@/presentation/player-compare";
import { formatSheetStat } from "@/presentation/roster-sheet-columns";
import {
  bestInColumn,
  DEFAULT_SHEET_SORT,
  groupSheetRows,
  moveSortColumn,
  sheetColumns,
  sortSheetRows,
  type SheetColumn,
  type SheetSort,
  type SheetTab,
} from "@/presentation/roster-sheet-model";
import type { SheetPlayerView } from "@/state/roster-sheet-view";

/** Rating columns shown as plain numbers whatever the grade/rating display. */
const PLAIN_RATING_IDS = new Set(["ovr", "pot"]);

function RosterName(props: { player: SheetPlayerView }) {
  const { player } = props;
  return (
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
  );
}

function RosterCell(props: {
  column: SheetColumn;
  player: SheetPlayerView;
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

const TABS: ReadonlyArray<{ id: SheetTab; label: string }> = [
  { id: "simple", label: "Simple" },
  { id: "detail", label: "Detail" },
  { id: "stats", label: "Stats" },
];

/** The header button's wording for the current compare state. */
function compareLabel(
  marked: SheetPlayerView | null,
  selected: SheetPlayerView | null,
): string {
  if (!marked) return "Compare";
  if (selected && marked.playerId === selected.playerId) return "Clear compare";
  return `Compare with ${marked.lastName}`;
}

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
  players: SheetPlayerView[];
  returnPath: string;
  /**
   * "market" drops role groups and the roster actions (free agents); "league"
   * is another team's read-only roster (no Contracts link or actions).
   */
  variant?: "roster" | "market" | "league";
  /** Link target for the market variant's "View in Free Agency". */
  marketHref?: string;
  /** Grid aria-label; defaults to "Roster sheet". */
  label?: string;
}) {
  const { openPlayer } = useEntityDrawer();
  const router = useRouter();
  const variant = props.variant ?? "roster";
  const [mode] = useRatingDisplay();
  const [tab, setTab] = useState<SheetTab>("simple");
  const [sortState, setSortState] = useState<SheetSort>(DEFAULT_SHEET_SORT);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [markedId, setMarkedId] = useState<string | null>(null);

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

  const marked =
    props.players.find((player) => player.playerId === markedId) ?? null;

  /**
   * First press marks the selected player; pressing again on another player
   * opens the compare page (marked first), and on the marked player clears it.
   */
  function toggleCompare() {
    if (!selected) return;
    if (!marked) {
      setMarkedId(selected.playerId);
    } else if (marked.playerId === selected.playerId) {
      setMarkedId(null);
    } else {
      router.push(
        compareHref(props.saveId, {
          a: marked.playerId,
          b: selected.playerId,
        }),
      );
    }
  }

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
      case "c":
      case "C":
        toggleCompare();
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

      {marked ? (
        <p
          role="status"
          className="flex flex-wrap items-center gap-2 text-sm text-soft"
        >
          <span>
            Comparing {marked.firstName} {marked.lastName}. Select another
            player and press C to compare.
          </span>
          <Button
            type="button"
            variant="quiet"
            onClick={() => setMarkedId(null)}
          >
            Cancel compare
          </Button>
        </p>
      ) : null}

      {selected ? (
        <SheetHeader
          saveId={props.saveId}
          player={selected}
          returnPath={props.returnPath}
          mode={mode}
          variant={variant}
          marketHref={props.marketHref}
          compareLabel={compareLabel(marked, selected)}
          onCompare={toggleCompare}
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
        renderName={(player) => <RosterName player={player} />}
        renderCell={(column, player) => (
          <RosterCell
            column={column}
            player={player}
            best={bests.get(column.id)?.has(player.playerId) ?? false}
            mode={mode}
          />
        )}
        rowClassName={(player) => (!player.canPlay ? "opacity-70" : undefined)}
        label={props.label}
        onKeyDown={onKeyDown}
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <KeyHint keys={["↑", "↓"]} label="Select" />
        <KeyHint keys={["←", "→"]} label="Sort" />
        <KeyHint keys="Enter" label="Player card" />
        <KeyHint keys={["[", "]"]} label="Tabs" />
        <KeyHint keys="C" label="Compare" />
      </div>
    </div>
  );
}
