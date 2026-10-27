import Link from "next/link";
import { Gauge } from "@/components/ui/Gauge";
import { NavIcon } from "@/components/game/shell/NavIcon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ViewSwitch } from "@/components/ui/ViewSwitch";
import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import type {
  MediaFilterOption,
  MediaScoreSide,
  MediaScoreView,
  MediaTimelinePageView,
  MediaTrendView,
} from "@/state/media-timeline/page-view";
import { MediaUnreadBadge } from "./MediaUnreadBadge";
import { TeamMark } from "./timeline/TeamMark";

function activeFilterKey(filters: readonly MediaFilterOption[]): string {
  return filters.find((option) => option.active)?.filter ?? "";
}

/** Below xl: the page's one tab row, scrolling sideways on phones. */
export function MediaFilterTabs(props: {
  filters: readonly MediaFilterOption[];
}) {
  return (
    <ViewSwitch
      aria-label="Timeline filters"
      className="max-w-full overflow-x-auto"
      activeKey={activeFilterKey(props.filters)}
      items={props.filters.map((option) => ({
        key: option.filter,
        label: option.label,
        href: option.href,
        badge:
          option.badge !== null ? (
            <MediaUnreadBadge count={option.badge} />
          ) : undefined,
      }))}
    />
  );
}

const FILTER_ICONS: Record<MediaFilterOption["filter"], string> = {
  "for-you": "home",
  "your-team": "team",
  league: "league",
  scores: "schedule",
  moves: "transactions",
  injuries: "injuries",
  awards: "awards",
};

/** At xl: the same filters as a vertical list in the left column. */
export function MediaFilterList(props: {
  filters: readonly MediaFilterOption[];
}) {
  return (
    <nav aria-label="Timeline filters">
      <ul className="space-y-1">
        {props.filters.map((option) => (
          <li key={option.filter}>
            <Link
              href={option.href}
              aria-current={option.active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-r-lg border-l-2 px-3 text-sm font-semibold transition",
                option.active
                  ? "border-team-ink bg-surface-high/60 text-ink"
                  : "border-transparent text-muted hover:bg-surface-raised hover:text-ink",
                focusRingClass,
              )}
            >
              <NavIcon name={FILTER_ICONS[option.filter]} />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.badge !== null ? (
                <MediaUnreadBadge count={option.badge} />
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ScoreLine(props: {
  side: MediaScoreSide;
  won: boolean;
  ot?: boolean;
}) {
  const { side, won } = props;
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-sm tabular-nums",
        won ? "font-bold text-ink" : "text-muted",
      )}
    >
      <TeamMark branding={side.branding} size="sm" />
      <span className="uppercase">{side.abbreviation}</span>
      {props.ot ? <span className="font-normal text-muted">OT</span> : null}
      <span className="ml-auto">{side.score}</span>
    </span>
  );
}

function ScoreRow(props: { score: MediaScoreView }) {
  const { score } = props;
  const body = (
    <>
      <ScoreLine side={score.away} won={score.away.score > score.home.score} />
      <ScoreLine
        side={score.home}
        won={score.home.score > score.away.score}
        ot={score.overtime}
      />
    </>
  );
  const rowClass = cn(
    "flex min-h-11 flex-col justify-center gap-1 border-l-2 px-3 py-2",
    score.isUserGame ? "border-team-ink" : "border-transparent",
  );
  if (score.href) {
    return (
      <Link
        href={score.href}
        className={cn(rowClass, "hover:bg-surface-raised", focusRingClass)}
      >
        {body}
      </Link>
    );
  }
  return <div className={rowClass}>{body}</div>;
}

/** Below xl: the latest game day's results in one sideways-scrolling row. */
export function MediaScoresStrip(props: {
  scores: readonly MediaScoreView[];
  dateLabel: string | null;
}) {
  if (props.scores.length === 0) return null;
  return (
    <section aria-label={`Scores, ${props.dateLabel ?? "latest"}`}>
      <ul className="-mx-4 flex snap-x overflow-x-auto divide-x divide-line px-4 pb-1 sm:mx-0 sm:px-0">
        {props.scores.map((score) => (
          <li key={score.gameId} className="w-40 shrink-0 snap-start">
            <ScoreRow score={score} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TrendingList(props: { trending: readonly MediaTrendView[] }) {
  return (
    <ol className="divide-y divide-line">
      {props.trending.map((trend) => (
        <li key={trend.tag}>
          <Link
            href={trend.href}
            className={cn(
              "flex w-full items-center justify-between gap-3 text-sm",
              touchTargetTextClass,
              linkClass,
              focusRingClass,
            )}
          >
            <span>#{trend.tag.replace(/\s+/g, "")}</span>
            <span className="tabular-nums text-muted">
              {trend.count} {trend.count === 1 ? "post" : "posts"}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** At xl: right rail with the latest scores, trending tags and buzz. */
export function MediaSideRail(props: { view: MediaTimelinePageView }) {
  const { view } = props;
  return (
    <div className="space-y-8">
      {view.scores.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading
            as="h2"
            title={`Scores · ${view.scoresDateLabel ?? "Latest"}`}
            titleClassName="whitespace-nowrap truncate"
          />
          <ul className="divide-y divide-line">
            {view.scores.map((score) => (
              <li key={score.gameId}>
                <ScoreRow score={score} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {view.trending.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading as="h2" title="Trending" titleClassName="truncate" />
          <TrendingList trending={view.trending} />
        </section>
      ) : null}
      <MediaBuzz buzz={view.buzz} />
    </div>
  );
}

/** Franchise media attention; the business effects live on the Business page. */
export function MediaBuzz(props: { buzz: MediaTimelinePageView["buzz"] }) {
  return (
    <section className="space-y-3">
      <SectionHeading as="h2" title="Your buzz" titleClassName="truncate" />
      <Gauge label="Media attention" value={props.buzz.mediaAttention} />
      <Link
        href={props.buzz.href}
        className={cn(
          "text-sm",
          touchTargetTextClass,
          linkClass,
          focusRingClass,
        )}
      >
        How buzz affects business
      </Link>
    </section>
  );
}
