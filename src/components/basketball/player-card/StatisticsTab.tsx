"use client";

import { useId, useState } from "react";
import { Section } from "@/components/ui/Section";
import type { PlayerStatsBundle } from "@/state/player-profile-selectors";
import { CareerSeasonsTable } from "./CareerSeasonsTable";
import { PerformanceChart } from "./PerformanceChart";
import { StatControls } from "./StatControls";
import { StatGroups } from "./StatGroups";
import { StatTile } from "./StatTile";
import {
  availableSplits,
  formatCount,
  defaultSeasonId,
  selectLine,
  seasonRows,
  type ExtendedMode,
  type StatMode,
  type StatScope,
  type StatSplit,
} from "./stat-view";

export function StatisticsTab(props: {
  saveId: string;
  playerId: string;
  stats: PlayerStatsBundle;
}) {
  const { stats } = props;
  const baseId = useId();
  const { seasons, career } = stats;
  const [scope, setScope] = useState<StatScope>("season");
  const [seasonId, setSeasonId] = useState<string | null>(() =>
    defaultSeasonId(seasons),
  );
  const [requestedSplit, setSplit] = useState<StatSplit>("regular");
  const [mode, setMode] = useState<StatMode>("perGame");

  const splits = availableSplits(stats, scope, seasonId);
  const split = splits.includes(requestedSplit) ? requestedSplit : "regular";
  const line = selectLine(stats, scope, seasonId, split);
  const season = seasons.find((s) => s.seasonId === seasonId);

  let extended: ExtendedMode = "complete";
  if (scope === "season" && season?.source === "snapshot") {
    extended = "unavailable";
  } else if (scope === "career" && !career.extendedColumnsComplete) {
    extended = "partial";
  }

  const hasGames = line != null && line.games > 0;

  return (
    <Section title="Statistics" density="compact">
      <div className="space-y-5">
        <StatControls
          baseId={baseId}
          scope={scope}
          onScope={setScope}
          seasons={seasons}
          seasonId={seasonId}
          onSeason={setSeasonId}
          splits={splits}
          split={split}
          onSplit={setSplit}
          mode={mode}
          onMode={setMode}
        />

        {hasGames && line ? (
          <>
            <div
              role="group"
              aria-label="Per-game summary"
              className="grid grid-cols-3 gap-2 sm:grid-cols-5"
            >
              <StatTile
                label="PPG"
                value={formatCount(line.points, line.games, "perGame")}
              />
              <StatTile
                label="RPG"
                value={formatCount(line.rebounds, line.games, "perGame")}
              />
              <StatTile
                label="APG"
                value={formatCount(line.assists, line.games, "perGame")}
              />
              <StatTile
                label="SPG"
                value={formatCount(line.steals, line.games, "perGame")}
              />
              <StatTile
                label="BPG"
                value={formatCount(line.blocks, line.games, "perGame")}
              />
            </div>
            <StatGroups line={line} mode={mode} extended={extended} />
            {scope === "career" ? (
              <CareerSeasonsTable
                rows={seasonRows(seasons, split)}
                career={career[split]}
                mode={mode}
              />
            ) : null}
          </>
        ) : (
          <p
            role="status"
            className="rounded-lg border border-line px-4 py-6 text-center text-sm text-faint"
          >
            No games played in this split.
          </p>
        )}

        <PerformanceChart
          baseId={baseId}
          saveId={props.saveId}
          playerId={props.playerId}
          stats={stats}
          scope={scope}
          seasonId={seasonId}
          split={split}
        />
      </div>
    </Section>
  );
}
