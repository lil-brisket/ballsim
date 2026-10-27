import Link from "next/link";
import { useId, type ReactNode } from "react";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { TeamThemeScope } from "@/components/ui/TeamThemeScope";
import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import type {
  TimelineDisplayContext,
  TimelinePostView,
} from "@/state/media-timeline/post-view";
import type {
  TimelineAttachment,
  TimelinePlayerRef,
  TimelineTeamRef,
} from "@/state/media-timeline/types";
import type { TeamBrandingView } from "@/state/team-branding-view";
import { AccountAvatar } from "./AccountAvatar";
import { PlayerNameLink, teamBrandingFor } from "./attachment-parts";
import { StatLine } from "./StatLine";
import { TeamMark } from "./TeamMark";

/** The team whose colours carry the story; null for league-wide news. */
export function heroTeamOf(
  attachment: TimelineAttachment,
): TimelineTeamRef | null {
  switch (attachment.type) {
    case "game":
      return attachment.winnerTeamId === attachment.home.teamId
        ? attachment.home
        : attachment.away;
    case "performance":
    case "streak":
      return attachment.team;
    case "award":
    case "signing":
    case "injury":
      return attachment.team;
    case "award_race":
      return attachment.contenders[0]?.team ?? null;
    case "playoff":
      return attachment.winner;
    case "trade":
      return attachment.teams[0] ?? null;
    case "league":
      return null;
  }
}

/**
 * Headline: the post's first sentence without hashtags; the rest (an angle
 * or context line) becomes the dek. Hashtags stay in the feed, not the hero.
 */
export function heroHeadline(text: string): {
  headline: string;
  dek: string | null;
} {
  const clean = text
    .replace(/#[A-Za-z0-9_]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const match = /^(.+?[.!?])\s+(.+)$/.exec(clean);
  if (!match) return { headline: clean, dek: null };
  return { headline: match[1]!, dek: match[2]! };
}

function uniformOf(branding: TeamBrandingView | null) {
  return branding
    ? {
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
      }
    : null;
}

function HeroPortrait(props: {
  player: TimelinePlayerRef;
  branding: TeamBrandingView | null;
  context: TimelineDisplayContext;
}) {
  return (
    <PlayerPortrait
      playerId={props.player.playerId}
      firstName={props.player.firstName}
      lastName={props.player.lastName}
      size="xl"
      portrait={props.context.portraits[props.player.playerId] ?? null}
      uniform={uniformOf(props.branding)}
    />
  );
}

/** Logo, abbreviation and score for one side of a final. */
function ScoreSide(props: {
  team: TimelineTeamRef;
  branding: TeamBrandingView | null;
  score: number;
  won: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1",
        !props.won && "opacity-75",
      )}
    >
      <TeamMark branding={props.branding} size="lg" />
      <span className="font-display text-sm uppercase tracking-wide text-soft">
        {props.team.abbreviation}
      </span>
      <ScoreNumeral
        value={props.score}
        size="xl"
        align="center"
        className={props.won ? undefined : "[&>span]:font-medium"}
      />
    </div>
  );
}

/** The right-hand graphic and the numbers under the headline. */
function heroGraphic(
  attachment: TimelineAttachment,
  branding: TeamBrandingView | null,
  context: TimelineDisplayContext,
): {
  graphic: ReactNode;
  numbers: ReactNode;
  player: TimelinePlayerRef | null;
} {
  switch (attachment.type) {
    case "performance": {
      const l = attachment.line;
      return {
        graphic: (
          <HeroPortrait
            player={attachment.player}
            branding={branding}
            context={context}
          />
        ),
        numbers: (
          <StatLine
            size="lg"
            primary={[
              { label: "PTS", value: String(l.points) },
              { label: "REB", value: String(l.rebounds) },
              { label: "AST", value: String(l.assists) },
            ]}
          />
        ),
        player: attachment.player,
      };
    }
    case "award":
      return {
        graphic: attachment.winner ? (
          <HeroPortrait
            player={attachment.winner}
            branding={branding}
            context={context}
          />
        ) : (
          <TeamMark branding={branding} size="lg" />
        ),
        numbers:
          attachment.stats.length > 0 ? (
            <StatLine size="lg" primary={attachment.stats} />
          ) : null,
        player: attachment.winner,
      };
    case "award_race": {
      const leader = attachment.contenders[0]?.player ?? null;
      return {
        graphic: leader ? (
          <HeroPortrait player={leader} branding={branding} context={context} />
        ) : (
          <TeamMark branding={branding} size="lg" />
        ),
        numbers: null,
        player: leader,
      };
    }
    case "game": {
      const { home, away, score, winnerTeamId } = attachment;
      return {
        graphic: (
          <div
            className="flex items-start gap-4"
            data-hero-score=""
            aria-hidden="true"
          >
            <ScoreSide
              team={away}
              branding={teamBrandingFor(context, away)}
              score={score.away}
              won={winnerTeamId === away.teamId}
            />
            <span className="pt-6 text-sm font-medium uppercase tracking-wide text-muted">
              {attachment.overtimePeriods > 0 ? "Final/OT" : "Final"}
            </span>
            <ScoreSide
              team={home}
              branding={teamBrandingFor(context, home)}
              score={score.home}
              won={winnerTeamId === home.teamId}
            />
          </div>
        ),
        numbers: null,
        player: null,
      };
    }
    case "streak":
      return {
        graphic: <TeamMark branding={branding} size="lg" />,
        numbers: (
          <StatLine
            size="lg"
            primary={[
              {
                label:
                  attachment.event === "losing_streak"
                    ? "Straight losses"
                    : attachment.event === "win_streak"
                      ? "Straight wins"
                      : "Win streak snapped",
                value: String(attachment.length),
                tone: attachment.event === "losing_streak" ? "loss" : "win",
              },
            ]}
          />
        ),
        player: null,
      };
    case "playoff":
      return {
        graphic: <TeamMark branding={branding} size="lg" />,
        numbers: attachment.seriesScore ? (
          <StatLine
            size="lg"
            primary={[
              {
                label: "Series",
                value: `${attachment.seriesScore.winner}–${attachment.seriesScore.loser}`,
              },
            ]}
          />
        ) : null,
        player: null,
      };
    default:
      return {
        graphic: <TeamMark branding={branding} size="lg" />,
        numbers: null,
        player: null,
      };
  }
}

/**
 * The per-kind graphic and numbers for a post, in the lead team's branding.
 * Shared by the top-story hero and the story slides.
 */
export function postHeroGraphic(
  post: TimelinePostView,
  context: TimelineDisplayContext,
): {
  branding: TeamBrandingView | null;
  graphic: ReactNode;
  numbers: ReactNode;
  player: TimelinePlayerRef | null;
} {
  const team = heroTeamOf(post.attachment);
  const branding = team ? teamBrandingFor(context, team) : null;
  const hero = heroGraphic(post.attachment, branding, context);
  // League news has no lead team: the author's mark stands in.
  const graphic =
    post.attachment.type === "league" ? (
      <AccountAvatar account={post.author} context={context} size="large" />
    ) : (
      hero.graphic
    );
  return { branding, graphic, numbers: hero.numbers, player: hero.player };
}

/**
 * The Media Hub's one hero: the top story as a broadcast graphic in the lead
 * team's colours. The post is not repeated in the feed below.
 */
export function TopStoryHero(props: {
  post: TimelinePostView;
  context: TimelineDisplayContext;
}) {
  const { post, context } = props;
  const headlineId = useId();
  const { headline, dek } = heroHeadline(post.text);
  const { branding, graphic, numbers, player } = postHeroGraphic(post, context);

  return (
    // Container query: side by side only when the hero itself is wide; the
    // Media Hub's 40rem column keeps the graphic on top of the headline.
    <section aria-label="Top story" className="@container">
      <TeamThemeScope
        branding={branding}
        className="relative isolate overflow-hidden rounded-2xl border border-surface-line bg-surface-arena"
      >
        <div aria-hidden="true" className="media-hero-spotlight -z-10" />
        {branding ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 -z-10 h-56 w-56 opacity-10"
            data-hero-watermark=""
          >
            <TeamLogoMark
              branding={branding}
              className="h-full w-full"
              decorative
            />
          </span>
        ) : null}

        <article
          aria-labelledby={headlineId}
          className="flex flex-col-reverse gap-5 p-5 sm:p-6 @3xl:grid @3xl:grid-cols-[minmax(0,1fr)_auto] @3xl:items-center"
        >
          <div className="min-w-0 space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-team-ink">
              Top story
            </p>
            <p
              id={headlineId}
              className="line-clamp-2 font-display text-2xl font-bold leading-tight text-ink sm:text-3xl"
            >
              {headline}
            </p>
            {dek ? <p className="text-base text-soft">{dek}</p> : null}
            {numbers}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <AccountAvatar
                account={post.author}
                context={context}
                size="reply"
              />
              <span className="font-medium text-ink">
                {post.author.displayName}
              </span>
              <span aria-hidden="true">·</span>
              <time
                dateTime={post.occurredOn}
                title={post.dateLabel}
                className="text-xs"
              >
                {post.relativeLabel}
              </time>
              {post.boxScoreHref ? (
                <Link
                  href={post.boxScoreHref}
                  className={cn(
                    linkClass,
                    focusRingClass,
                    touchTargetTextClass,
                    "ml-auto",
                  )}
                >
                  Box score
                </Link>
              ) : player ? (
                <PlayerNameLink
                  saveId={context.saveId}
                  player={player}
                  className="ml-auto"
                />
              ) : null}
            </div>
          </div>
          <div className="flex justify-center @3xl:justify-end">{graphic}</div>
        </article>
      </TeamThemeScope>
    </section>
  );
}
