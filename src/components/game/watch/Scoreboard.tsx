import { ScoreNumeral, TeamBadge, TeamThemeScope } from "@/components/ui";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
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

export function Scoreboard(props: {
  away: WatchTeam;
  home: WatchTeam;
  live: LiveBoxScore;
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
    </ArenaPanel>
  );
}
