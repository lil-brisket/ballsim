import Link from "next/link";
import { Gauge } from "@/components/ui/Gauge";
import { ScoreBug } from "@/components/ui/ScoreBug";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Tabs } from "@/components/ui/Tabs";
import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import type {
  MediaFilterOption,
  MediaScoreView,
  MediaTimelinePageView,
  MediaTrendView,
} from "@/state/media-timeline/page-view";
import { MediaUnreadBadge } from "./MediaUnreadBadge";

function activeFilterKey(filters: readonly MediaFilterOption[]): string {
  return filters.find((option) => option.active)?.filter ?? "";
}

/** Below xl: the page's one tab row, scrolling sideways on phones. */
export function MediaFilterTabs(props: {
  filters: readonly MediaFilterOption[];
}) {
  return (
    <Tabs
      aria-label="Timeline filters"
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
                "flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 text-sm font-semibold transition",
                option.active
                  ? "bg-zinc-800 text-zinc-50"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
                focusRingClass,
              )}
            >
              {option.label}
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

function ScoreItem(props: { score: MediaScoreView }) {
  const { score } = props;
  return (
    <ScoreBug
      teams={[score.away, score.home]}
      date={score.date}
      overtime={score.overtime}
      href={score.href ?? undefined}
    />
  );
}

/** Below xl: the latest game day's results in one sideways-scrolling row. */
export function MediaScoresStrip(props: {
  scores: readonly MediaScoreView[];
  dateLabel: string | null;
}) {
  if (props.scores.length === 0) return null;
  return (
    <section aria-label={`Scores, ${props.dateLabel ?? "latest"}`}>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {props.scores.map((score) => (
          <li key={score.gameId} className="shrink-0">
            <ScoreItem score={score} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TrendingList(props: { trending: readonly MediaTrendView[] }) {
  return (
    <ol className="space-y-1">
      {props.trending.map((trend) => (
        <li key={trend.tag}>
          <Link
            href={trend.href}
            className={cn(
              "flex items-center justify-between gap-3 text-sm",
              touchTargetTextClass,
              linkClass,
              focusRingClass,
            )}
          >
            <span>#{trend.tag.replace(/\s+/g, "")}</span>
            <span className="tabular-nums text-zinc-400">
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
          />
          <ul className="space-y-2">
            {view.scores.map((score) => (
              <li key={score.gameId}>
                <ScoreItem score={score} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {view.trending.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading as="h2" title="Trending" />
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
      <SectionHeading as="h2" title="Your buzz" />
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
