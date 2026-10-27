import { buttonClass } from "@/components/ui/Button";
import { cn } from "@/components/ui/styles";
import type {
  LiveBoxScoreRow,
  WatchPlayer,
  WatchTeam,
} from "@/state/watch-game-view";

const STATS: Array<[label: string, key: keyof LiveBoxScoreRow]> = [
  ["PTS", "points"],
  ["REB", "rebounds"],
  ["AST", "assists"],
  ["STL", "steals"],
  ["BLK", "blocks"],
  ["TO", "turnovers"],
];

/**
 * Selected player's live line, read straight from the live box score row
 * (no stat code of its own).
 */
export function CourtPlayerCard(props: {
  player: WatchPlayer;
  team: WatchTeam;
  row: LiveBoxScoreRow;
  onClose: () => void;
}) {
  const { player, team, row } = props;
  return (
    <div
      className="border-t border-line pt-3"
      data-testid="court-player-card"
      aria-label={`${player.fullName} live stats`}
      role="region"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{player.fullName}</p>
          <p className="text-sm text-muted">
            {[player.position, `${team.city} ${team.name}`]
              .filter(Boolean)
              .join(" · ")}
            {row.onCourt ? " · On court" : " · On the bench"}
          </p>
        </div>
        <button
          type="button"
          className={cn(buttonClass({ variant: "secondary" }), "shrink-0")}
          onClick={props.onClose}
        >
          Close
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-6 gap-2 text-center">
        {STATS.map(([label, key]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-faint">{label}</dt>
            <dd className="font-mono text-base tabular-nums text-ink">
              {row[key] as number}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
