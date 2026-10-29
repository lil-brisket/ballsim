"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { Drawer } from "@/components/ui/Drawer";
import { FocusGrid } from "@/components/ui/focus/FocusGrid";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SlantTabs } from "@/components/ui/Tabs";
import { cn, focusRingClass, linkClass } from "@/components/ui/styles";
import type { BracketLayout } from "@/state/playoff-bracket-layout";
import type {
  PlayoffHubView,
  PlayoffSeriesView,
} from "@/state/playoff-hub-selectors";
import type { TeamBrandingView } from "@/state/team-branding-view";

/** Desktop geometry in px; lines and cards are computed from the layout. */
const COL_W = 184;
const COL_GAP = 40;
const HEADER_H = 32;
const ROW_H = 88;
const CARD_H = 72;
const SWIPE_PX = 40;

type TeamRowData = {
  teamId: string;
  name: string;
  abbreviation: string;
  branding: TeamBrandingView | null;
  seed: number | null;
  wins: number;
  /** This team skipped the opening round. */
  bye: boolean;
  /** Bye team shown alone, still waiting for its opponent. */
  waiting: boolean;
};

/** The two rows of a slot, higher seed first; null is "TBD". */
function teamRows(
  series: PlayoffSeriesView,
): [TeamRowData | null, TeamRowData | null] {
  const higher: TeamRowData | null =
    series.higherSeedTeamId && series.higherSeedTeamName
      ? {
          teamId: series.higherSeedTeamId,
          name: series.higherSeedTeamName,
          abbreviation: series.higherSeedAbbreviation ?? "",
          branding: series.higherSeedBranding,
          seed: series.higherSeed,
          wins: series.higherWins,
          bye: series.bye?.teamId === series.higherSeedTeamId,
          waiting: false,
        }
      : null;
  const lower: TeamRowData | null =
    series.lowerSeedTeamId && series.lowerSeedTeamName
      ? {
          teamId: series.lowerSeedTeamId,
          name: series.lowerSeedTeamName,
          abbreviation: series.lowerSeedAbbreviation ?? "",
          branding: series.lowerSeedBranding,
          seed: series.lowerSeed,
          wins: series.lowerWins,
          bye: series.bye?.teamId === series.lowerSeedTeamId,
          waiting: false,
        }
      : null;
  if (!higher && !lower && series.bye) {
    return [
      {
        teamId: series.bye.teamId,
        name: series.bye.teamName,
        abbreviation: series.bye.abbreviation,
        branding: series.bye.branding,
        seed: series.bye.seed,
        wins: 0,
        bye: true,
        waiting: true,
      },
      null,
    ];
  }
  return [higher, lower];
}

function statusText(series: PlayoffSeriesView): string {
  if (series.status === "complete") {
    const winner = teamRows(series).find(
      (row) => row?.teamId === series.winnerTeamId,
    );
    return winner ? `${winner.name} won` : "complete";
  }
  return series.status === "active" ? "in progress" : "not started";
}

function slotLabel(series: PlayoffSeriesView, userTeamId: string): string {
  const prefix = series.conferenceName
    ? `${series.conferenceName} ${series.roundLabel}`
    : series.roundLabel;
  const teams = teamRows(series).map((row) =>
    row
      ? `${row.seed != null ? `#${row.seed} ` : ""}${row.name}${
          row.waiting ? " (bye)" : ` ${row.wins}`
        }${row.teamId === userTeamId ? " (your team)" : ""}`
      : "TBD",
  );
  return `${prefix}: ${teams.join(", ")}, ${statusText(series)}`;
}

function drawerTitle(series: PlayoffSeriesView): string {
  const [higher, lower] = teamRows(series);
  return `${series.roundLabel}: ${higher?.name ?? "TBD"} vs ${lower?.name ?? "TBD"}`;
}

function TeamRow(props: {
  row: TeamRowData | null;
  series: PlayoffSeriesView;
  userTeamId: string;
}) {
  const { row, series } = props;
  if (!row) {
    return (
      <div className="flex h-8 items-center gap-1.5 border-l-4 border-transparent px-2 text-sm text-disabled">
        TBD
      </div>
    );
  }
  const decided = series.status === "complete" && series.winnerTeamId != null;
  const won = decided && series.winnerTeamId === row.teamId;
  const lost = decided && !won;
  const mine = row.teamId === props.userTeamId;
  return (
    <div
      className={cn(
        "flex h-8 items-center gap-1.5 border-l-4 px-2 text-sm",
        won ? "font-semibold text-ink" : lost ? "text-muted" : "text-ink",
        mine ? "bg-team/15" : "",
        mine && !row.branding ? "border-team-ink" : "border-transparent",
      )}
      style={
        mine && row.branding
          ? { borderLeftColor: row.branding.primaryColor }
          : undefined
      }
    >
      <span className="w-6 shrink-0 text-xs tabular-nums text-muted">
        {row.seed != null ? `#${row.seed}` : ""}
      </span>
      {row.branding ? (
        <TeamLogoMark branding={row.branding} size="sm" decorative />
      ) : null}
      <span className="min-w-0 truncate" title={row.name}>
        {row.abbreviation}
        <span className="sr-only"> {row.name}</span>
      </span>
      {mine ? <span className="sr-only">(your team)</span> : null}
      {row.bye ? (
        <span className="text-sm font-normal text-muted">Bye</span>
      ) : null}
      {won ? (
        <>
          <span aria-hidden="true">✓</span>
          <span className="sr-only">won series</span>
        </>
      ) : null}
      <span className="ml-auto font-mono tabular-nums">
        {row.waiting ? "" : row.wins}
      </span>
    </div>
  );
}

function SeriesSlot(props: {
  series: PlayoffSeriesView;
  userTeamId: string;
  onOpen: (seriesId: string) => void;
  /** Positioned by the desktop tree; otherwise in flow. */
  absolute?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const { series } = props;
  const [higher, lower] = teamRows(series);
  // One position class only: cn does not resolve Tailwind conflicts.
  return (
    <div
      className={cn(props.absolute ? "absolute" : "relative", props.className)}
      style={props.style}
    >
      {series.status === "active" ? (
        <span className="absolute -top-2 right-2 z-10">
          <StatusBadge label="Live" tone="active" />
        </span>
      ) : null}
      <button
        type="button"
        data-focus-item=""
        data-series-id={series.id}
        aria-label={slotLabel(series, props.userTeamId)}
        onClick={() => props.onOpen(series.id)}
        className={cn(
          "block h-full w-full overflow-hidden rounded-lg border bg-surface-raised text-left transition-colors motion-reduce:transition-none",
          series.involvesUser
            ? "border-team-ink/60"
            : "border-line hover:border-line-strong",
          focusRingClass,
        )}
      >
        <TeamRow row={higher} series={series} userTeamId={props.userTeamId} />
        <div className="border-t border-line" />
        <TeamRow row={lower} series={series} userTeamId={props.userTeamId} />
      </button>
    </div>
  );
}

function SeriesDrawer(props: {
  saveId: string;
  series: PlayoffSeriesView | null;
  onClose: () => void;
}) {
  const { series } = props;
  const rows = series ? teamRows(series) : [null, null];
  return (
    <Drawer
      open={series != null}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      title={series ? drawerTitle(series) : "Series"}
    >
      {series ? (
        <div className="space-y-4">
          <p className="text-sm text-soft">
            {rows[0] || rows[1]
              ? rows
                  .map((row) =>
                    row
                      ? `${row.name} ${row.waiting ? "(bye)" : row.wins}`
                      : "TBD",
                  )
                  .join(" · ")
              : "Teams not decided yet."}
          </p>
          {series.games.length === 0 ? (
            <p className="text-sm text-muted">No games yet.</p>
          ) : (
            <ul className="space-y-2">
              {series.games.map((game) => (
                <li key={game.gameId}>
                  <Link
                    href={`/dashboard/${props.saveId}/games/${game.gameId}`}
                    className={cn(
                      linkClass,
                      "flex min-h-11 flex-wrap items-center gap-x-3 text-sm",
                      focusRingClass,
                    )}
                  >
                    <span className="font-medium">Game {game.number}</span>
                    {game.date ? (
                      <span className="text-muted">{game.date}</span>
                    ) : null}
                    <span className="tabular-nums">
                      {game.final &&
                      game.awayScore != null &&
                      game.homeScore != null
                        ? `${game.awayAbbreviation} ${game.awayScore} @ ${game.homeAbbreviation} ${game.homeScore}`
                        : "Scheduled"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}

type TreeProps = {
  layout: BracketLayout;
  seriesById: Map<string, PlayoffSeriesView>;
  userTeamId: string;
  onOpen: (seriesId: string) => void;
};

function DesktopTree(props: TreeProps) {
  const { layout } = props;
  const columnCount = layout.columns.length;
  const width = columnCount * COL_W + (columnCount - 1) * COL_GAP;
  const bodyHeight = layout.rowCount * ROW_H;
  const columnOf = new Map<string, number>();
  layout.columns.forEach((column, index) => {
    for (const id of column.seriesIds) columnOf.set(id, index);
  });
  const centerY = (id: string) =>
    HEADER_H + (layout.rowOf[id] ?? 0) * ROW_H + CARD_H / 2;

  const paths = layout.edges.flatMap((edge) => {
    const from = columnOf.get(edge.fromSeriesId);
    const to = columnOf.get(edge.toSeriesId);
    if (from === undefined || to === undefined) return [];
    const fromLeft = from * (COL_W + COL_GAP);
    const toLeft = to * (COL_W + COL_GAP);
    // Feeders left of their target exit on the right edge; mirrored (right
    // side) feeders exit on the left edge.
    const rightward = from <= to;
    const startX = rightward ? fromLeft + COL_W : fromLeft;
    const endX = rightward ? toLeft : toLeft + COL_W;
    const midX = (startX + endX) / 2;
    return [
      {
        key: `${edge.fromSeriesId}>${edge.toSeriesId}`,
        d: `M${startX} ${centerY(edge.fromSeriesId)}H${midX}V${centerY(edge.toSeriesId)}H${endX}`,
      },
    ];
  });

  return (
    <div className="relative hidden overflow-x-auto pb-2 lg:block">
      <FocusGrid aria-label="Playoff bracket" className="relative">
        <div className="relative" style={{ width }}>
          <svg
            aria-hidden="true"
            focusable="false"
            width={width}
            height={HEADER_H + bodyHeight}
            className="pointer-events-none absolute left-0 top-0 text-line-strong"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            {paths.map((path) => (
              <path key={path.key} d={path.d} />
            ))}
          </svg>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${columnCount}, ${COL_W}px)`,
              columnGap: COL_GAP,
            }}
          >
            {layout.columns.map((column) => (
              <div key={column.key}>
                <p
                  className="flex items-center text-sm font-semibold uppercase tracking-wide text-muted"
                  style={{ height: HEADER_H }}
                >
                  {column.conferenceName
                    ? `${column.conferenceName} · ${column.label}`
                    : column.label}
                </p>
                <div className="relative" style={{ height: bodyHeight }}>
                  {column.seriesIds.map((id) => {
                    const series = props.seriesById.get(id);
                    if (!series) return null;
                    return (
                      <SeriesSlot
                        key={id}
                        series={series}
                        userTeamId={props.userTeamId}
                        onOpen={props.onOpen}
                        absolute
                        className="left-0 w-full"
                        style={{
                          top: (layout.rowOf[id] ?? 0) * ROW_H,
                          height: CARD_H,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </FocusGrid>
    </div>
  );
}

function MobileRounds(props: TreeProps) {
  const columns = props.layout.columns;
  const [index, setIndex] = useState(() => {
    const live = columns.findIndex((column) =>
      column.seriesIds.some(
        (id) => props.seriesById.get(id)?.status === "active",
      ),
    );
    return live >= 0 ? live : Math.max(0, columns.length - 1);
  });
  const tabsRef = useRef<HTMLDivElement>(null);
  const refocusTab = useRef(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  // After a keyboard move, focus follows the newly selected tab.
  useEffect(() => {
    if (!refocusTab.current) return;
    refocusTab.current = false;
    tabsRef.current
      ?.querySelector<HTMLElement>('button[aria-pressed="true"]')
      ?.focus();
  }, [index]);

  if (columns.length === 0) return null;
  const active = columns[Math.min(index, columns.length - 1)]!;
  const move = (delta: number) =>
    setIndex((current) =>
      Math.min(columns.length - 1, Math.max(0, current + delta)),
    );

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    refocusTab.current = true;
    move(event.key === "ArrowRight" ? 1 : -1);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    move(dx < 0 ? 1 : -1);
  }

  const roundName = active.conferenceName
    ? `${active.conferenceName} ${active.label}`
    : active.label;

  return (
    <div className="space-y-3 lg:hidden">
      <div ref={tabsRef} onKeyDown={onTabKeyDown}>
        <SlantTabs
          aria-label="Playoff rounds"
          activeKey={active.key}
          items={columns.map((column, position) => ({
            key: column.key,
            label: column.conferenceName
              ? `${column.conferenceName} ${column.label}`
              : column.label,
            onSelect: () => setIndex(position),
          }))}
        />
      </div>
      <div
        role="region"
        aria-label={`Playoff round: ${roundName}`}
        className="touch-pan-y"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
      >
        <FocusGrid className="space-y-3">
          {active.seriesIds.map((id) => {
            const series = props.seriesById.get(id);
            if (!series) return null;
            return (
              <SeriesSlot
                key={id}
                series={series}
                userTeamId={props.userTeamId}
                onOpen={props.onOpen}
                className="w-full"
                style={{ height: CARD_H }}
              />
            );
          })}
        </FocusGrid>
      </div>
    </div>
  );
}

/**
 * The playoff bracket: a connected tree on large screens, one round at a time
 * (tabs plus swipe) below `lg`. Both are rendered and CSS picks one, so the
 * markup is identical on the server and the client.
 */
export function BracketTree(props: {
  saveId: string;
  hub: PlayoffHubView;
  layout: BracketLayout;
}) {
  const { hub, layout } = props;
  const seriesById = new Map<string, PlayoffSeriesView>();
  for (const round of hub.rounds) {
    for (const series of round.series) seriesById.set(series.id, series);
  }
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? (seriesById.get(openId) ?? null) : null;
  const shared: TreeProps = {
    layout,
    seriesById,
    userTeamId: hub.userTeamId,
    onOpen: setOpenId,
  };
  return (
    <div className="space-y-3">
      <DesktopTree {...shared} />
      <MobileRounds {...shared} />
      <SeriesDrawer
        saveId={props.saveId}
        series={open}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
