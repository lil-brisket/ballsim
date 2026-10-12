import Link from "next/link";
import { parseCalendarDate } from "@/domain/calendar-date";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TickerBar, type TickerItem } from "@/components/ui/TickerBar";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";

function formatLongDate(isoDate: string): string {
  try {
    const { year, month, day } = parseCalendarDate(isoDate);
    const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return utc.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return isoDate;
  }
}

export function LeagueHeader(props: {
  leagueName: string;
  seasonYear: number;
  seasonPhaseLabel: string;
  currentDate: string;
  userTeamLabel: string;
  playoffBanner?: string | null;
}) {
  return (
    <ArenaPanel
      as="header"
      hero
      edge="top"
      density="comfortable"
      aria-labelledby="league-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <SectionHeading
            as="h1"
            size="lg"
            id="league-title"
            eyebrow="League"
            title={props.leagueName}
          />
          <p className="text-sm text-zinc-200">
            {formatLongDate(props.currentDate)}
            <span className="mx-2 text-zinc-600">·</span>
            {props.seasonYear} · {props.seasonPhaseLabel}
          </p>
          <p className="text-xs text-zinc-400">
            Your team · {props.userTeamLabel}
          </p>
        </div>
        {props.playoffBanner ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-sm text-amber-200">
            {props.playoffBanner}
          </p>
        ) : null}
      </div>
    </ArenaPanel>
  );
}

export function MyTeamContextStrip(props: {
  saveId: string;
  teamId: string;
  city: string;
  name: string;
  abbreviation: string;
  wins: number;
  losses: number;
  conferenceRank: number;
  conferenceName: string;
  gamesBack: number;
  streakLabel: string | null;
  leagueLeader: { abbreviation: string; wins: number; losses: number };
  cutoffTeam: { abbreviation: string; wins: number; losses: number } | null;
}) {
  const confShort = props.conferenceName.replace(/ Conference$/i, "");
  const gb =
    props.gamesBack === 0
      ? "—"
      : props.gamesBack % 1 === 0
        ? `${props.gamesBack} GB`
        : `${props.gamesBack.toFixed(1)} GB`;

  const items: TickerItem[] = [
    { label: "Conference", value: `#${props.conferenceRank} ${confShort}` },
    { label: "Games back", value: gb },
  ];
  if (props.streakLabel) {
    items.push({ label: "Streak", value: props.streakLabel });
  }
  items.push({
    label: "League Leader",
    value: `${props.leagueLeader.abbreviation} ${props.leagueLeader.wins}–${props.leagueLeader.losses}`,
  });
  if (props.cutoffTeam) {
    items.push({
      label: "Playoff Cutoff",
      value: `${props.cutoffTeam.abbreviation} ${props.cutoffTeam.wins}–${props.cutoffTeam.losses}`,
    });
  }

  return (
    <ArenaPanel
      as="section"
      raised
      edge="left"
      density="compact"
      className="space-y-3"
      aria-labelledby="my-team-context-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-team-ink">
            Your Team
          </p>
          <p
            id="my-team-context-title"
            className="font-display text-2xl font-bold uppercase leading-tight tracking-wide text-zinc-50"
          >
            {props.city} {props.name}
          </p>
        </div>
        <ScoreNumeral
          value={`${props.wins}–${props.losses}`}
          label="Record"
          labelBelow
          size="md"
          tone="team"
          align="center"
        />
        <Link
          href={`/dashboard/${props.saveId}/team`}
          className={cn(
            touchTargetClass,
            "rounded-lg border-2 border-team-ink bg-team px-4 font-display text-lg font-bold uppercase tracking-wide text-on-team hover:brightness-110",
            focusRingClass,
          )}
        >
          View Team
        </Link>
      </div>
      <TickerBar aria-label="Standing context" items={items} />
    </ArenaPanel>
  );
}
