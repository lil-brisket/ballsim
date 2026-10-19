import { ScoreNumeral, TeamBadge, TeamThemeScope } from "@/components/ui";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { periodLabel } from "@/state/watch-game-selectors";
import type { LiveBoxScore, WatchTeam } from "@/state/watch-game-view";

function TeamBlock(props: {
  team: WatchTeam;
  score: number;
  fouls: number;
  align: "start" | "end";
}) {
  const end = props.align === "end";
  return (
    <TeamThemeScope
      branding={props.team.branding}
      className={`flex min-w-0 items-center gap-3 ${
        end ? "flex-row-reverse text-right" : ""
      }`}
    >
      <TeamBadge
        branding={props.team.branding}
        name={`${props.team.city} ${props.team.name}`}
        size="lg"
        decorative
        className="hidden sm:inline-flex"
      />
      <div className={`min-w-0 ${end ? "items-end" : ""}`}>
        <p className="font-display text-2xl font-bold uppercase tracking-wide text-zinc-50">
          {props.team.abbreviation}
        </p>
        <p className="truncate text-sm text-zinc-400">
          {props.team.name} · Fouls {props.fouls}
        </p>
      </div>
      <ScoreNumeral
        value={props.score}
        size="lg"
        tone="team"
        align={props.align}
        className="shrink-0"
      />
    </TeamThemeScope>
  );
}

/** Regulation periods always show; overtime columns appear once reached. */
const REGULATION_COLUMNS = 4;

function Linescore(props: {
  away: WatchTeam;
  home: WatchTeam;
  awayScore: number;
  homeScore: number;
  byPeriod: { away: number[]; home: number[] };
  currentPeriod: number;
}) {
  const columns = Math.max(REGULATION_COLUMNS, props.currentPeriod);
  const periods = Array.from({ length: columns }, (_, index) => index + 1);
  const rows = [
    {
      team: props.away,
      points: props.byPeriod.away,
      total: props.awayScore,
    },
    {
      team: props.home,
      points: props.byPeriod.home,
      total: props.homeScore,
    },
  ];
  return (
    <div className="mt-4 overflow-x-auto sm:flex sm:justify-center">
      <table className="w-full text-sm sm:w-auto">
        <caption className="sr-only">Points by quarter</caption>
        <thead>
          <tr className="text-zinc-400">
            <th scope="col" className="px-3 py-1 text-left font-medium">
              Team
            </th>
            {periods.map((period) => (
              <th
                key={period}
                scope="col"
                className={`px-3 py-1 text-right font-medium ${
                  period === props.currentPeriod ? "text-team-ink" : ""
                }`}
              >
                {periodLabel(period)}
              </th>
            ))}
            <th scope="col" className="px-3 py-1 text-right font-medium">
              T
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ team, points, total }) => (
            <tr key={team.teamId} className="border-t border-zinc-800">
              <th
                scope="row"
                className="px-3 py-1 text-left font-semibold text-zinc-100"
              >
                {team.abbreviation}
              </th>
              {periods.map((period) => (
                <td
                  key={period}
                  className={`px-3 py-1 text-right font-mono tabular-nums ${
                    period === props.currentPeriod
                      ? "font-bold text-zinc-50"
                      : "text-zinc-300"
                  }`}
                >
                  {period <= props.currentPeriod ? (
                    (points[period - 1] ?? 0)
                  ) : (
                    <>
                      <span aria-hidden>–</span>
                      <span className="sr-only">not played</span>
                    </>
                  )}
                </td>
              ))}
              <td className="px-3 py-1 text-right font-mono font-bold tabular-nums text-zinc-50">
                {total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Scoreboard(props: {
  away: WatchTeam;
  home: WatchTeam;
  live: LiveBoxScore;
  /** Points per period as of the revealed play. */
  byPeriod: { away: number[]; home: number[] };
  /** Period of the latest revealed play; 0 before tip-off. */
  currentPeriod: number;
}) {
  const { live } = props;
  return (
    <ArenaPanel
      as="header"
      hero
      density="comfortable"
      aria-labelledby="watch-scoreboard-status"
    >
      <p
        id="watch-scoreboard-status"
        className="mb-4 text-center font-display text-lg font-bold uppercase tracking-[0.3em] text-team-ink"
      >
        {live.isFinal ? (
          "Final"
        ) : (
          <>
            <span>{live.periodLabel}</span>{" "}
            <span className="tabular-nums">{live.clockLabel}</span>
          </>
        )}
      </p>
      <div
        role="group"
        aria-label={`Score: ${props.away.abbreviation} ${live.awayScore}, ${props.home.abbreviation} ${live.homeScore}`}
        className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center"
      >
        <TeamBlock
          team={props.away}
          score={live.awayScore}
          fouls={live.away.periodFouls}
          align="start"
        />
        <div
          aria-hidden
          className="hidden font-display text-3xl text-zinc-500 sm:block"
        >
          @
        </div>
        <TeamBlock
          team={props.home}
          score={live.homeScore}
          fouls={live.home.periodFouls}
          align="end"
        />
      </div>
      <Linescore
        away={props.away}
        home={props.home}
        awayScore={live.awayScore}
        homeScore={live.homeScore}
        byPeriod={props.byPeriod}
        currentPeriod={props.currentPeriod}
      />
    </ArenaPanel>
  );
}
