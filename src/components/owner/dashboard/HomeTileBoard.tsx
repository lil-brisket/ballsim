import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import { HubTile } from "@/components/ui/HubTile";
import { FocusGrid } from "@/components/ui/focus/FocusGrid";
import { OvrBadge } from "@/components/ui/OvrBadge";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { cn } from "@/components/ui/styles";
import { formatGameDate } from "@/presentation/game-date";
import type {
  OwnerDashboardMetricContext,
  OwnerDashboardView,
} from "@/state/owner-dashboard";
import type { TimelinePostView } from "@/state/media-timeline/post-view";

/** The slice of the owner dashboard the tile board reads. */
export type HomeTileBoardData = Pick<
  OwnerDashboardView,
  "tradeInbox" | "tradesOpen" | "daysUntilTradeDeadline" | "home"
> & {
  team: Pick<OwnerDashboardView["team"], "strength" | "upcomingGames">;
  owner: {
    patience: number;
    ownership: Pick<OwnerDashboardView["owner"]["ownership"], "moodLabel">;
  };
  health: {
    cash: number;
    cashContext: OwnerDashboardMetricContext | null;
  };
  mediaTimeline: {
    posts: Pick<TimelinePostView, "id" | "text">[];
    unreadCount: number;
  };
};

const SCHEDULE_TILE_GAMES = 5;

function CountChip(props: { count: number; label: string }) {
  return (
    <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-warning px-1.5 text-xs font-semibold tabular-nums leading-4 text-surface-base">
      <span aria-hidden>{props.count > 99 ? "99+" : props.count}</span>
      <span className="sr-only">
        {props.count} {props.label}
      </span>
    </span>
  );
}

function splitName(name: string): { first: string; last: string } {
  const space = name.indexOf(" ");
  return space < 0
    ? { first: name, last: "" }
    : { first: name.slice(0, space), last: name.slice(space + 1) };
}

function TopPlayerArt(props: {
  player: NonNullable<HomeTileBoardData["home"]["topPlayer"]>;
}) {
  const { player } = props;
  const name = splitName(player.name);
  return (
    <span className="flex items-end gap-2">
      <PlayerPortrait
        playerId={player.playerId}
        firstName={name.first}
        lastName={name.last}
        portrait={player.portrait}
        size="sm"
      />
      <OvrBadge overall={player.overall} size="sm" />
    </span>
  );
}

function tradesNote(data: HomeTileBoardData): string | null {
  if (!data.tradesOpen) return "Trading is closed";
  if (data.daysUntilTradeDeadline != null) {
    const days = data.daysUntilTradeDeadline;
    return `Deadline in ${days} day${days === 1 ? "" : "s"}`;
  }
  return null;
}

/**
 * Home tile board: eight links to the hubs, each carrying the one fact that
 * hub owns. Single column on phones, two from `sm`, five from `xl` (the two
 * wide tiles take two cells, so the board is two rows tall).
 */
export function HomeTileBoard(props: {
  saveId: string;
  data: HomeTileBoardData;
}) {
  const { saveId, data } = props;
  const base = `/dashboard/${saveId}`;
  const { topPlayer, biggestRiser, standing } = data.home;
  const lead = data.mediaTimeline.posts[0];
  const pending = data.tradeInbox.totalPending;
  const games = data.team.upcomingGames.slice(0, SCHEDULE_TILE_GAMES);
  const cashDirection = data.health.cashContext?.direction;
  const tradeNote = tradesNote(data);

  return (
    <FocusGrid
      memoryKey="home"
      aria-label="Hub tiles"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
    >
      <HubTile
        enterIndex={0}
        dense
        href={`${base}/roster`}
        title="Roster"
        stat={{ value: data.team.strength, label: "Team strength" }}
        art={topPlayer ? <TopPlayerArt player={topPlayer} /> : undefined}
      >
        {topPlayer ? `Top: ${topPlayer.name}, ${topPlayer.position}` : null}
      </HubTile>

      <HubTile
        enterIndex={1}
        dense
        href={`${base}/league/standings`}
        title="Standings"
        stat={
          standing
            ? {
                value: `#${standing.conferenceRank}`,
                label: `${standing.conferenceName} seed`,
              }
            : undefined
        }
      >
        {standing
          ? standing.gamesBack > 0
            ? `${standing.gamesBack} GB`
            : "Leading the conference"
          : "Standings start with the season"}
      </HubTile>

      <HubTile
        enterIndex={2}
        dense
        href={`${base}/media`}
        title="Media"
        size="wide"
        badge={
          data.mediaTimeline.unreadCount > 0 ? (
            <CountChip count={data.mediaTimeline.unreadCount} label="unread" />
          ) : undefined
        }
      >
        {lead ? (
          <span className="line-clamp-2">{lead.text}</span>
        ) : (
          "No league stories yet"
        )}
      </HubTile>

      <HubTile
        enterIndex={3}
        dense
        href={`${base}/finances`}
        title="Finances"
        stat={{ value: formatMoney(data.health.cash), label: "Cash" }}
      >
        {data.health.cashContext ? (
          <>
            {cashDirection === "up" || cashDirection === "down" ? (
              <span
                aria-hidden
                className={cn(
                  "mr-1",
                  cashDirection === "up" ? "text-win" : "text-loss",
                )}
              >
                {cashDirection === "up" ? "▲" : "▼"}
              </span>
            ) : null}
            {data.health.cashContext.text}
          </>
        ) : null}
      </HubTile>

      <HubTile
        enterIndex={4}
        dense
        href={`${base}/trades`}
        title="Trades"
        stat={{ value: pending, label: "Offers waiting" }}
        badge={
          pending > 0 ? <CountChip count={pending} label="offers" /> : undefined
        }
      >
        {tradeNote}
      </HubTile>

      <HubTile
        enterIndex={5}
        dense
        href={`${base}/calendar`}
        title="Schedule"
        size="wide"
      >
        {games.length === 0 ? (
          "No games scheduled"
        ) : (
          <span className="flex flex-wrap gap-x-4 gap-y-2">
            {games.map((game) => (
              <span
                key={game.gameId}
                className="flex flex-col items-center gap-1"
              >
                <span className="flex items-center gap-1">
                  <TeamBadge
                    branding={game.opponentBranding}
                    name={game.opponentName}
                    size="sm"
                    decorative
                  />
                  <span className="sr-only">{game.opponentName}</span>
                </span>
                <span className="whitespace-nowrap text-sm text-soft">
                  {game.home ? "vs" : "@"} {formatGameDate(game.date)}
                </span>
              </span>
            ))}
          </span>
        )}
      </HubTile>

      <HubTile
        enterIndex={6}
        dense
        href={`${base}/development`}
        title="Development"
        stat={
          biggestRiser
            ? {
                value: <span className="text-win">+{biggestRiser.delta}</span>,
                label: biggestRiser.name,
              }
            : undefined
        }
      >
        {biggestRiser ? "Biggest riser" : "No rating changes yet"}
      </HubTile>

      <HubTile
        enterIndex={7}
        dense
        href={`${base}/franchise/ownership`}
        title="Owner"
        stat={{ value: data.owner.patience, label: "Owner patience" }}
      >
        {data.owner.ownership.moodLabel}
      </HubTile>
    </FocusGrid>
  );
}
