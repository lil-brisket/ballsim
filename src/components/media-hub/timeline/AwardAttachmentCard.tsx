import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { formatSeasonLabel } from "@/state/media-timeline/compose-text";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type { AwardAttachment } from "@/state/media-timeline/types";
import { PlayerNameLink, teamBrandingFor } from "./attachment-parts";
import { StatLine } from "./StatLine";
import { TeamSurface } from "./TeamSurface";

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

export function awardPeriodLabel(award: AwardAttachment): string {
  if (award.cadence === "monthly" && award.period) {
    const match = /^(\d{4})-(\d{2})/.exec(award.period);
    if (match) {
      return MONTH_FORMAT.format(
        new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)),
      );
    }
  }
  return `${formatSeasonLabel(award.seasonYear)} season`;
}

function Monogram(props: { name: string }) {
  const initials = props.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 font-display text-2xl font-bold text-zinc-200"
    >
      {initials}
    </span>
  );
}

function TrophyIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="28"
      height="28"
      aria-hidden="true"
      data-award-icon="trophy"
      className="shrink-0 text-team-ink"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M9 5h14v8a7 7 0 0 1-14 0V5z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      <path d="M9 8H5v2a4 4 0 0 0 4 4M23 8h4v2a4 4 0 0 1-4 4" />
      <path d="M16 20v4M11 27h10M13 24h6" />
    </svg>
  );
}

function MedalIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="28"
      height="28"
      aria-hidden="true"
      data-award-icon="medal"
      className="shrink-0 text-team-ink"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 3l6 11M22 3l-6 11" />
      <circle cx="16" cy="21" r="7" fill="currentColor" fillOpacity="0.2" />
      <path d="M16 18v6M14 19l2-1" />
    </svg>
  );
}

export function AwardAttachmentCard(props: {
  attachment: AwardAttachment;
  context: TimelineDisplayContext;
}) {
  const { attachment: award, context } = props;
  const branding = award.team ? teamBrandingFor(context, award.team) : null;
  const { winner, stats, teamRecord, runnerUp } = award;
  const uniform = branding
    ? {
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
      }
    : null;
  // Coach awards carry the record in their stats.
  const secondary =
    teamRecord && winner
      ? [{ label: "Record", value: `${teamRecord.wins}–${teamRecord.losses}` }]
      : [];

  return (
    <TeamSurface branding={branding} band="top">
      <div className="flex items-center gap-2">
        {award.cadence === "yearly" ? <TrophyIcon /> : <MedalIcon />}
        <p className="font-display text-xl font-bold leading-tight text-zinc-50">
          {award.awardName}
        </p>
      </div>
      <p className="mt-0.5 text-sm text-zinc-400">{awardPeriodLabel(award)}</p>

      <div className="mt-4 flex items-center gap-4">
        {winner ? (
          <PlayerPortrait
            playerId={winner.playerId}
            firstName={winner.firstName}
            lastName={winner.lastName}
            size="lg"
            portrait={context.portraits[winner.playerId] ?? null}
            uniform={uniform}
          />
        ) : award.team ? (
          <TeamBadge
            branding={branding}
            name={award.team.displayName}
            size="lg"
            decorative
          />
        ) : award.winnerCoachName ? (
          <Monogram name={award.winnerCoachName} />
        ) : null}
        <div className="min-w-0">
          {winner ? (
            <PlayerNameLink
              saveId={context.saveId}
              player={winner}
              className="font-display text-lg"
            />
          ) : award.winnerCoachName ? (
            <p className="font-display text-lg text-zinc-50">
              {award.winnerCoachName}
            </p>
          ) : null}
          {award.team ? (
            <p className="flex items-center gap-2 text-sm text-zinc-400">
              {branding ? (
                <TeamLogoMark branding={branding} size="sm" decorative />
              ) : null}
              <span>
                {award.team.displayName}
                {winner ? null : " head coach"}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {stats.length > 0 || secondary.length > 0 ? (
        <div className="mt-4">
          <StatLine primary={stats} secondary={secondary} />
        </div>
      ) : null}

      {runnerUp ? (
        <p className="mt-3 text-sm text-zinc-400">
          Runner-up: {runnerUp.name}
          {runnerUp.teamAbbreviation ? ` (${runnerUp.teamAbbreviation})` : ""}
        </p>
      ) : null}
    </TeamSurface>
  );
}
