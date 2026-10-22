import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { TeamThemeScope } from "@/components/ui/TeamThemeScope";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type { AwardAttachment } from "@/state/media-timeline/types";
import {
  PlayerNameLink,
  attachmentSurfaceClass,
  seasonLabel,
  teamBrandingFor,
} from "./attachment-parts";

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
  return `${seasonLabel(award.seasonYear)} season`;
}

function oneDecimal(value: number): string {
  return value.toFixed(1);
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
      className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 font-display text-lg font-bold text-zinc-200"
    >
      {initials}
    </span>
  );
}

export function AwardAttachmentCard(props: {
  attachment: AwardAttachment;
  context: TimelineDisplayContext;
}) {
  const { attachment: award, context } = props;
  const branding = award.team ? teamBrandingFor(context, award.team) : null;
  const { winner, perGame, teamRecord, runnerUp } = award;

  return (
    <TeamThemeScope branding={branding} className={attachmentSurfaceClass}>
      <p className="font-display text-xl font-bold leading-tight text-zinc-50">
        {award.awardName}
      </p>
      <p className="text-sm text-zinc-400">{awardPeriodLabel(award)}</p>

      <div className="mt-3 flex items-center gap-3">
        {winner ? (
          <PlayerPortrait
            playerId={winner.playerId}
            firstName={winner.firstName}
            lastName={winner.lastName}
            size="md"
            portrait={context.portraits[winner.playerId] ?? null}
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
            <PlayerNameLink saveId={context.saveId} player={winner} />
          ) : award.winnerCoachName ? (
            <p className="text-zinc-50">{award.winnerCoachName}</p>
          ) : null}
          {award.team ? (
            <p className="text-sm text-zinc-400">
              {award.team.abbreviation}
              {winner ? null : " head coach"}
            </p>
          ) : null}
        </div>
      </div>

      {perGame ? (
        <div className="mt-3 flex gap-6">
          <ScoreNumeral
            size="sm"
            tone="team"
            label="PPG"
            labelBelow
            value={oneDecimal(perGame.points)}
          />
          <ScoreNumeral
            size="sm"
            label="RPG"
            labelBelow
            value={oneDecimal(perGame.rebounds)}
          />
          <ScoreNumeral
            size="sm"
            label="APG"
            labelBelow
            value={oneDecimal(perGame.assists)}
          />
        </div>
      ) : null}

      {teamRecord ? (
        <p className="mt-3 text-sm text-zinc-400">
          Team record{" "}
          <span className="font-semibold tabular-nums text-zinc-50">
            {teamRecord.wins}–{teamRecord.losses}
          </span>
        </p>
      ) : null}

      {runnerUp ? (
        <p className="mt-1 text-sm text-zinc-400">
          Runner-up: {runnerUp.name}
          {runnerUp.teamAbbreviation ? ` (${runnerUp.teamAbbreviation})` : ""}
        </p>
      ) : null}
    </TeamThemeScope>
  );
}
