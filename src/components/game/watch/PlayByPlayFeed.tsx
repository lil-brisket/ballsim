import { Panel, SectionHeading, StatusBadge, cn } from "@/components/ui";
import type {
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
    <li className="flex items-center gap-3 py-1 text-sm text-zinc-500">
      <span className="h-px flex-1 bg-surface-line" aria-hidden />
      <span>End of {props.label}</span>
      <span className="h-px flex-1 bg-surface-line" aria-hidden />
    </li>
  );
}

export function PlayByPlayFeed(props: {
  view: WatchGameView;
  revealed: number;
}) {
  const { view } = props;
  const visible = view.plays.slice(0, props.revealed);
  const rows = buildRows(visible);
  const teamOf = (side: WatchSide): WatchTeam =>
    side === 0 ? view.home : view.away;
  const atEnd = visible.length > 0 && visible.length === view.plays.length;

  // Newest first, with a separator wherever the period changes (and at the end).
  const items: React.ReactNode[] = [];
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
          className="flex items-baseline gap-3 px-3 py-1 text-sm text-zinc-500"
        >
          <span className="w-24 shrink-0 font-mono tabular-nums">
            {play.periodLabel} {play.clockLabel}
          </span>
          <span className="min-w-0 break-words">{play.text}</span>
        </li>,
      );
    } else {
      const last = row.plays[row.plays.length - 1]!;
      const team = teamOf(play.side);
      const scoring = row.plays.some((p) => p.points > 0);
      items.push(
        <li
          key={`group-${play.index}`}
          className={cn(
            "flex items-start gap-3 rounded-lg border px-3 py-2",
            scoring
              ? "border-zinc-700 bg-zinc-900"
              : "border-transparent bg-zinc-900/40",
          )}
        >
          <div className="w-24 shrink-0 space-y-1">
            <p className="font-mono text-xs tabular-nums text-zinc-400">
              {play.periodLabel} {play.clockLabel}
            </p>
            <span
              className="inline-block rounded border-l-4 bg-zinc-800 px-1.5 py-0.5 text-xs font-semibold uppercase text-zinc-200"
              style={{ borderLeftColor: team.branding.primaryColor }}
            >
              {team.abbreviation}
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            {row.plays.map((p) => (
              <div
                key={p.index}
                className="flex flex-wrap items-center gap-x-2 gap-y-1"
              >
                <p
                  className={cn(
                    "min-w-0 break-words text-sm",
                    p.points > 0 && "font-semibold text-zinc-50",
                    isFoul(p) && "text-warning",
                    p.points === 0 && !isFoul(p) && "text-zinc-300",
                  )}
                >
                  {p.text}
                </p>
                <HighlightBadges highlights={p.highlights} />
              </div>
            ))}
          </div>
          <p className="shrink-0 font-mono text-sm tabular-nums text-zinc-300">
            <span className="sr-only">Score </span>
            {view.away.abbreviation} {last.awayScore}
            {" – "}
            {view.home.abbreviation} {last.homeScore}
          </p>
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

  return (
    <Panel as="section" className="min-w-0 space-y-3">
      <SectionHeading as="h2" title="Play-by-play" />
      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Press Play to start the broadcast.
        </p>
      ) : null}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="max-h-[32rem] overflow-y-auto"
        data-testid="play-feed"
      >
        <ul className="space-y-1.5">{items}</ul>
      </div>
    </Panel>
  );
}
