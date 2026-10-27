import { StatusBadge, cn } from "@/components/ui";
import { focusRingClass } from "@/components/ui/styles";
import {
  START_PERIOD_CLOCK_SECONDS,
  formatGameClock,
} from "@/state/watch-game-selectors";
import { jumpBallText } from "@/state/watch-jump-ball";
import type {
  KeyMoment,
  WatchGameView,
  WatchHighlight,
  WatchPlay,
  WatchSide,
  WatchTeam,
} from "@/state/watch-game-view";

export const HIGHLIGHT_LABEL: Record<WatchHighlight, string> = {
  lead_change: "Lead change",
  tie: "Tie",
  run: "Run",
  clutch: "Clutch",
  foul_out: "Foul out",
  and_one: "And-one",
};

const HIGHLIGHT_TONE: Record<WatchHighlight, string> = {
  lead_change: "active",
  tie: "neutral",
  run: "success",
  clutch: "warning",
  foul_out: "critical",
  and_one: "info",
};

export function visibleKeyMoments(
  keyMoments: KeyMoment[],
  revealed: number,
  isFinal: boolean,
): KeyMoment[] {
  return keyMoments.filter((moment) =>
    moment.playIndex === null ? isFinal : moment.playIndex < revealed,
  );
}

type FeedRow =
  | { type: "group"; plays: WatchPlay[] }
  | { type: "substitution"; play: WatchPlay };

function isFoul(play: WatchPlay): boolean {
  return (
    play.kind === "shooting_foul" ||
    play.kind === "personal_foul" ||
    play.kind === "offensive_foul"
  );
}

/** Oldest-first rows: consecutive same-possession plays share a row. */
function buildRows(plays: WatchPlay[]): FeedRow[] {
  const rows: FeedRow[] = [];
  for (const play of plays) {
    if (play.kind === "substitution") {
      rows.push({ type: "substitution", play });
      continue;
    }
    const last = rows[rows.length - 1];
    if (
      last?.type === "group" &&
      last.plays[0]!.period === play.period &&
      last.plays[0]!.poss === play.poss
    ) {
      last.plays.push(play);
    } else {
      rows.push({ type: "group", plays: [play] });
    }
  }
  return rows;
}

function rowPlay(row: FeedRow): WatchPlay {
  return row.type === "group" ? row.plays[0]! : row.play;
}

function HighlightBadges(props: { highlights: WatchHighlight[] }) {
  return (
    <>
      {props.highlights.map((highlight) => (
        <StatusBadge
          key={highlight}
          label={HIGHLIGHT_LABEL[highlight]}
          tone={HIGHLIGHT_TONE[highlight]}
        />
      ))}
    </>
  );
}

function PeriodSeparator(props: { label: string }) {
  return (
    <li className="flex items-center gap-3 py-1 text-sm text-faint">
      <span className="h-px flex-1 bg-surface-line" aria-hidden />
      <span>End of {props.label}</span>
      <span className="h-px flex-1 bg-surface-line" aria-hidden />
    </li>
  );
}

function MomentText(props: { moment: KeyMoment }) {
  return (
    <span className="block">
      <span className="block text-sm font-semibold text-ink">
        {props.moment.title}
      </span>
      <span className="block text-sm text-muted">{props.moment.detail}</span>
    </span>
  );
}

const MOMENT_CLASS = "border-team-ink/50 bg-team/15";

export function PlayByPlayFeed(props: {
  view: WatchGameView;
  revealed: number;
  onJump: (revealed: number) => void;
}) {
  const { view } = props;
  const visible = view.plays.slice(0, props.revealed);
  const rows = buildRows(visible);
  const teamOf = (side: WatchSide): WatchTeam =>
    side === 0 ? view.home : view.away;
  // The tip is inferred, not logged: it shows once the first play has
  // settled, as the oldest entry.
  const tipText = visible.length > 0 ? jumpBallText(view) : null;
  const atEnd = visible.length > 0 && visible.length === view.plays.length;
  const moments = visibleKeyMoments(view.keyMoments, props.revealed, atEnd);

  // Newest first, with a separator wherever the period changes (and at the end).
  const items: React.ReactNode[] = [];
  moments.forEach((moment, index) => {
    if (moment.playIndex === null) {
      items.push(
        <li
          key={`post-${index}`}
          className={cn("rounded-lg border border-l-4 px-3 py-2", MOMENT_CLASS)}
        >
          <MomentText moment={moment} />
        </li>,
      );
    }
  });
  if (atEnd) {
    items.push(
      <PeriodSeparator
        key="end"
        label={rowPlay(rows[rows.length - 1]!).periodLabel}
      />,
    );
  }
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i]!;
    const play = rowPlay(row);
    if (row.type === "substitution") {
      items.push(
        <li
          key={`sub-${play.index}`}
          className="flex items-baseline gap-3 px-3 py-1 text-sm text-faint"
        >
          <span className="w-24 shrink-0 tabular-nums">
            {play.periodLabel} {play.clockLabel}
          </span>
          <span className="min-w-0 break-words">{play.text}</span>
        </li>,
      );
    } else {
      const last = row.plays[row.plays.length - 1]!;
      const team = teamOf(play.side);
      const points = row.plays.reduce((sum, p) => sum + p.points, 0);
      const scoring = points > 0;
      const scoringSide =
        row.plays.find((p) => p.points > 0)?.side ?? play.side;
      const scoringTeam = teamOf(scoringSide);
      const rowMoments = moments.filter(
        (moment) =>
          moment.playIndex !== null &&
          row.plays.some((p) => p.index === moment.playIndex),
      );
      const awayScoring = scoring && scoringSide === 1;
      const homeScoring = scoring && scoringSide === 0;
      items.push(
        <li key={`group-${play.index}`}>
          <button
            type="button"
            onClick={() => props.onJump(last.index + 1)}
            className={cn(
              "flex min-h-11 w-full items-start gap-3 rounded-lg border border-l-4 px-3 py-2 text-left hover:border-disabled",
              rowMoments.length > 0
                ? MOMENT_CLASS
                : scoring
                  ? "border-line-strong bg-surface-raised"
                  : "border-transparent bg-surface-raised/40",
              focusRingClass,
            )}
            style={{
              borderLeftColor: scoring
                ? scoringTeam.branding.primaryColor
                : "transparent",
            }}
          >
            <span className="block w-24 shrink-0 space-y-1">
              <span className="block text-sm tabular-nums text-muted">
                {play.periodLabel} {play.clockLabel}
              </span>
              <span
                className="inline-block rounded border-l-4 bg-surface-high px-1.5 py-0.5 text-xs font-semibold uppercase text-ink"
                style={{ borderLeftColor: team.branding.primaryColor }}
              >
                {team.abbreviation}
              </span>
            </span>
            <span className="block min-w-0 flex-1 space-y-1">
              {rowMoments.map((moment) => (
                <MomentText
                  key={`moment-${moment.playIndex}`}
                  moment={moment}
                />
              ))}
              {row.plays.map((p) => (
                <span
                  key={`play-${p.index}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1"
                >
                  <span
                    className={cn(
                      "min-w-0 break-words text-sm",
                      p.points > 0 && "font-semibold text-ink",
                      isFoul(p) && "text-warning",
                      p.points === 0 && !isFoul(p) && "text-soft",
                    )}
                  >
                    {p.text}
                  </span>
                  <HighlightBadges highlights={p.highlights} />
                </span>
              ))}
            </span>
            <span className="block shrink-0 text-right text-sm tabular-nums text-muted">
              <span className="sr-only">Score </span>
              <span className={cn(awayScoring && "font-semibold text-ink")}>
                {view.away.abbreviation} {last.awayScore}
              </span>
              {" – "}
              <span className={cn(homeScoring && "font-semibold text-ink")}>
                {view.home.abbreviation} {last.homeScore}
              </span>
              {scoring ? (
                <span className="ml-2 font-semibold text-ink">+{points}</span>
              ) : null}
            </span>
          </button>
        </li>,
      );
    }
    const older = rows[i - 1];
    if (older && rowPlay(older).period !== play.period) {
      items.push(
        <PeriodSeparator
          key={`sep-${rowPlay(older).period}`}
          label={rowPlay(older).periodLabel}
        />,
      );
    }
  }

  if (tipText) {
    items.push(
      <li
        key="jump-ball"
        className="flex items-baseline gap-3 px-3 py-1 text-sm text-faint"
      >
        <span className="w-24 shrink-0 tabular-nums">
          Q1 {formatGameClock(START_PERIOD_CLOCK_SECONDS)}
        </span>
        <span className="min-w-0 break-words">{tipText}</span>
      </li>,
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      {visible.length === 0 ? (
        <p className="text-sm text-faint">Press Play to start the broadcast.</p>
      ) : null}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="max-h-80 overflow-y-auto lg:max-h-[32rem]"
        data-testid="play-feed"
      >
        <ul className="space-y-1.5">{items}</ul>
      </div>
    </div>
  );
}
