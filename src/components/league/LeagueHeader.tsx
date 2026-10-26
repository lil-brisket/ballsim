import Link from "next/link";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StreakChip } from "@/components/league/StreakChip";
import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";

export type LeagueHeaderTeam = {
  conferenceRank: number;
  conferenceName: string;
  gamesBack: number;
  streakLabel: string | null;
};

function gamesBackLabel(gamesBack: number): string {
  if (gamesBack === 0) return "Leads";
  return gamesBack % 1 === 0 ? `${gamesBack}` : gamesBack.toFixed(1);
}

/**
 * League hub hero: leads with your place in the race (conference seed, games
 * back, streak). The league name is a small title. Date, season, record and
 * league rank live in the game header and are not repeated here.
 */
export function LeagueHeader(props: {
  saveId: string;
  leagueName: string;
  myTeam?: LeagueHeaderTeam | null;
  playoffBanner?: string | null;
}) {
  const team = props.myTeam;
  const confShort = team?.conferenceName.replace(/ Conference$/i, "");

  return (
    <ArenaPanel
      as="header"
      hero
      edge="top"
      density="comfortable"
      className="space-y-4"
      aria-labelledby="league-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading
          as="h1"
          size="md"
          id="league-title"
          title={props.leagueName}
        />
        {props.playoffBanner ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-sm text-warning">
            {props.playoffBanner}
          </p>
        ) : null}
      </div>

      {team ? (
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <ScoreNumeral
            value={`#${team.conferenceRank}`}
            label={`${confShort} seed`}
            labelBelow
            size="lg"
            tone="team"
          />
          <ScoreNumeral
            value={gamesBackLabel(team.gamesBack)}
            label="Games back"
            labelBelow
            size="md"
          />
          {team.streakLabel ? (
            <div className="flex flex-col gap-1">
              <StreakChip label={team.streakLabel} />
              <span className="text-sm text-muted">Streak</span>
            </div>
          ) : null}
          <Link
            href={`/dashboard/${props.saveId}/team`}
            className={cn(
              touchTargetTextClass,
              linkClass,
              "text-sm sm:ml-auto",
              focusRingClass,
            )}
          >
            View team
          </Link>
        </div>
      ) : null}
    </ArenaPanel>
  );
}
