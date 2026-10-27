"use client";

import { cn, focusRingClass, linkClass } from "@/components/ui/styles";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, numericCellClass } from "@/components/ui/DataTable";
import { Section } from "@/components/ui/Section";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { formatGameDate } from "@/presentation/game-date";
import type {
  PlayerGameLogRowView,
  PlayerProfileView,
} from "@/state/player-profile-selectors";

type SortKey = Exclude<keyof PlayerGameLogRowView, "opponentBranding">;

const PAGE_SIZE = 25;

const GAME_LOG_COLUMNS: Array<[SortKey, string, boolean]> = [
  ["date", "Date", false],
  ["opponentAbbreviation", "Opp", false],
  ["won", "Result", false],
  ["minutes", "MIN", true],
  ["points", "PTS", true],
  ["rebounds", "REB", true],
  ["assists", "AST", true],
  ["steals", "STL", true],
  ["blocks", "BLK", true],
  ["turnovers", "TO", true],
  ["fgMade", "FG", true],
  ["threeMade", "3PT", true],
  ["ftMade", "FT", true],
];

export function PlayerGameLog(props: {
  player: PlayerProfileView;
  saveId: string;
}) {
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [competitionFilter, setCompetitionFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const seasons = useMemo(() => {
    const years = new Set(props.player.gameLog.map((row) => row.seasonYear));
    return [...years].sort((a, b) => b - a);
  }, [props.player.gameLog]);

  const filtered = useMemo(() => {
    let rows = [...props.player.gameLog];
    if (seasonFilter !== "all") {
      rows = rows.filter((row) => String(row.seasonYear) === seasonFilter);
    }
    if (competitionFilter !== "all") {
      rows = rows.filter((row) => row.competitionType === competitionFilter);
    }
    rows.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sortAsc ? -1 : 1;
      return sortAsc ? 1 : -1;
    });
    return rows;
  }, [props.player.gameLog, seasonFilter, competitionFilter, sortKey, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "date" ? false : true);
    }
    setPage(0);
  }

  if (props.player.gameLog.length === 0) {
    return (
      <Section title="Game log">
        <EmptyState message="No game log entries for this player." />
      </Section>
    );
  }

  return (
    <Section
      title="Game log"
      action={
        <div className="flex flex-wrap gap-2">
          <Select
            aria-label="Season"
            value={seasonFilter}
            onChange={(event) => {
              setSeasonFilter(event.target.value);
              setPage(0);
            }}
          >
            <option value="all">All seasons</option>
            {seasons.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Competition"
            value={competitionFilter}
            onChange={(event) => {
              setCompetitionFilter(event.target.value);
              setPage(0);
            }}
          >
            <option value="all">RS + Playoffs</option>
            <option value="regular_season">Regular season</option>
            <option value="playoffs">Playoffs</option>
          </Select>
        </div>
      }
    >
      <DataTable
        caption="Game log"
        headers={GAME_LOG_COLUMNS.map(([key, label, numeric]) => ({
          label,
          numeric,
          sort: {
            onSelect: () => toggleSort(key),
            direction:
              sortKey === key
                ? sortAsc
                  ? ("asc" as const)
                  : ("desc" as const)
                : null,
          },
        }))}
      >
        {pageRows.map((row) => (
          <tr key={row.gameId}>
            <td className="px-3 py-2">
              <Link
                href={`/dashboard/${props.saveId}/games/${row.gameId}`}
                className={cn(linkClass, focusRingClass)}
              >
                {formatGameDate(row.date)}
              </Link>
            </td>
            <td className="px-3 py-2 text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span>{row.home ? "vs" : "@"}</span>
                {row.opponentBranding ? (
                  <span
                    className="inline-flex shrink-0 items-center justify-center rounded-sm p-0.5"
                    style={{
                      backgroundColor: row.opponentBranding.primaryColor,
                    }}
                  >
                    <TeamLogoMark
                      branding={row.opponentBranding}
                      size="sm"
                      decorative
                    />
                  </span>
                ) : null}
                <span>{row.opponentAbbreviation}</span>
              </span>
            </td>
            <td className="px-3 py-2 font-mono text-muted">
              {row.won === null
                ? "—"
                : `${row.won ? "W" : "L"} ${row.teamScore}-${row.opponentScore}`}
            </td>
            <td
              className={`px-3 py-2 font-mono text-muted ${numericCellClass}`}
            >
              {row.minutes}
            </td>
            <td className={`px-3 py-2 font-mono text-ink ${numericCellClass}`}>
              {row.points}
            </td>
            <td
              className={`px-3 py-2 font-mono text-muted ${numericCellClass}`}
            >
              {row.rebounds}
            </td>
            <td
              className={`px-3 py-2 font-mono text-muted ${numericCellClass}`}
            >
              {row.assists}
            </td>
            <td
              className={`px-3 py-2 font-mono text-muted ${numericCellClass}`}
            >
              {row.steals}
            </td>
            <td
              className={`px-3 py-2 font-mono text-muted ${numericCellClass}`}
            >
              {row.blocks}
            </td>
            <td
              className={`px-3 py-2 font-mono text-muted ${numericCellClass}`}
            >
              {row.turnovers}
            </td>
            <td
              className={`px-3 py-2 font-mono text-muted ${numericCellClass}`}
            >
              {row.fgMade}/{row.fgAttempted}
            </td>
            <td
              className={`px-3 py-2 font-mono text-muted ${numericCellClass}`}
            >
              {row.threeMade}/{row.threeAttempted}
            </td>
            <td
              className={`px-3 py-2 font-mono text-muted ${numericCellClass}`}
            >
              {row.ftMade}/{row.ftAttempted}
            </td>
          </tr>
        ))}
      </DataTable>
      {pageCount > 1 ? (
        <div className="mt-3 flex items-center justify-between text-sm text-faint">
          <span>
            Page {page + 1} of {pageCount} ({filtered.length} games)
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </Section>
  );
}
