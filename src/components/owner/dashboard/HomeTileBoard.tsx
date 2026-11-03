import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { formatPositionLabel } from "@/presentation/position-label";
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
import type { PlayoffPositionLabel } from "@/state/standings-selectors";

/** The slice of the owner dashboard the tile board reads. */
export type HomeTileBoardData = Pick<
  OwnerDashboardView,
  | "tradeInbox"
  | "tradesOpen"
  | "daysUntilTradeDeadline"
  | "home"
  | "nextImportantEvent"
> & {
  team: Pick<OwnerDashboardView["team"], "strength" | "upcomingGames">;
  owner: {
    patience: number;
    primaryObjectives: Pick<
      OwnerDashboardView["owner"]["primaryObjectives"][number],
      "description" | "status"
    >[];
    ownership: Pick<
      OwnerDashboardView["owner"]["ownership"],
      "moodLabel" | "concern"
    >;
  };
  health: {
    cash: number;
    cashContext: OwnerDashboardMetricContext | null;
    financialHealth: OwnerDashboardView["health"]["financialHealth"];
  };
};

const SCHEDULE_TILE_GAMES = 5;

const OUTLOOK_TEXT: Partial<Record<PlayoffPositionLabel, string>> = {
  clinched: "Playoffs clinched",
  playoff: "In playoff position",
  play_in: "In the play-in",
  bubble: "On the bubble",
  eliminated: "Eliminated",
};

function standingNote(
  standing: NonNullable<HomeTileBoardData["home"]["standing"]>,
): string {
  const gap =
    standing.gamesBack > 0
      ? `${standing.gamesBack} GB`
      : "Leading the conference";
  const outlook = OUTLOOK_TEXT[standing.playoffLabel];
  return [gap, outlook, standing.streakLabel].filter(Boolean).join(" · ");
}

function payrollNote(
  payroll: HomeTileBoardData["home"]["payroll"],
): string | null {
  if (payroll.taxLine === null)
    return `Payroll ${formatMoney(payroll.payroll)}`;
  const gap = payroll.taxLine - payroll.payroll;
  return gap >= 0
    ? `Payroll ${formatMoney(payroll.payroll)} · ${formatMoney(gap)} under tax`
    : `Payroll ${formatMoney(payroll.payroll)} · ${formatMoney(-gap)} over tax`;
}

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

function RiserArt(props: {
  riser: NonNullable<HomeTileBoardData["home"]["biggestRiser"]>;
}) {
  const { riser } = props;
  const name = splitName(riser.name);
  return (
    <PlayerPortrait
      playerId={riser.playerId}
      firstName={name.first}
      lastName={name.last}
      portrait={riser.portrait}
      size="sm"
    />
  );
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
 * Home tile board: seven links to the hubs, each carrying the one fact that
 * hub owns. Roster, Schedule and Trades are the large tiles (four columns
 * from `xl`); the media feed follows in `mediaSlot`, then Standings, Finances,
 * Development and Owner as a compact strip of secondary facts.
 */
export function HomeTileBoard(props: {
  saveId: string;
  data: HomeTileBoardData;
  /** Rendered between the large tiles and the secondary strip (the media feed). */
  mediaSlot?: React.ReactNode;
}) {
  const { saveId, data } = props;
  const base = `/dashboard/${saveId}`;
  const { topPlayer, biggestRiser, biggestFaller, standing, payroll } =
    data.home;
  const pending = data.tradeInbox.totalPending;
  const games = data.team.upcomingGames.slice(0, SCHEDULE_TILE_GAMES);
  const cashDirection = data.health.cashContext?.direction;
  const tradeNote = tradesNote(data);
  const objective = data.owner.primaryObjectives.find(
    (o) => o.status !== "completed" && o.status !== "failed",
  );
  const fundsTight =
    data.health.financialHealth === "warning" ||
    data.health.financialHealth === "critical" ||
    data.health.financialHealth === "insolvent";

  return (
    <div className="space-y-4">
      <FocusGrid
        aria-label="Hub tiles"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <HubTile
          enterIndex={0}
          dense
          href={`${base}/roster`}
          title="Roster"
          stat={{ value: data.team.strength, label: "Team strength" }}
          art={topPlayer ? <TopPlayerArt player={topPlayer} /> : undefined}
        >
          {topPlayer
            ? `Top: ${topPlayer.name}, ${formatPositionLabel(topPlayer.position, topPlayer.secondaryPosition)}`
            : null}
        </HubTile>

        <HubTile
          enterIndex={1}
          dense
          href={`${base}/calendar`}
          title="Schedule"
          size="wide"
        >
          {games.length === 0 ? (
            data.nextImportantEvent ? (
              <>
                Next: {data.nextImportantEvent.title} ·{" "}
                {formatGameDate(data.nextImportantEvent.date)}
              </>
            ) : (
              "No games scheduled"
            )
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
          enterIndex={2}
          dense
          href={`${base}/trades`}
          title="Trades"
          stat={{ value: pending, label: "Offers waiting" }}
          badge={
            pending > 0 ? (
              <CountChip count={pending} label="offers" />
            ) : undefined
          }
        >
          {tradeNote}
        </HubTile>
      </FocusGrid>

      {props.mediaSlot}

      <FocusGrid
        aria-label="More hubs"
        className="grid grid-cols-2 gap-4 xl:grid-cols-4"
      >
        <HubTile
          enterIndex={4}
          size="compact"
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
            ? standingNote(standing)
            : "Standings start with the season"}
        </HubTile>

        <HubTile
          enterIndex={5}
          size="compact"
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
          <span className="block">{payrollNote(payroll)}</span>
          {fundsTight ? (
            <span
              className={cn(
                "block font-medium",
                data.health.financialHealth === "warning"
                  ? "text-warning"
                  : "text-loss",
              )}
            >
              Business funds under pressure
            </span>
          ) : null}
        </HubTile>

        <HubTile
          enterIndex={6}
          size="compact"
          href={`${base}/development`}
          title="Development"
          art={biggestRiser ? <RiserArt riser={biggestRiser} /> : undefined}
          stat={
            biggestRiser
              ? {
                  value: (
                    <span className="text-win">+{biggestRiser.delta}</span>
                  ),
                  label: biggestRiser.name,
                }
              : undefined
          }
        >
          {biggestRiser ? "Biggest riser" : "No risers this season"}
          {biggestFaller ? (
            <span className="block">
              <span aria-hidden className="mr-1 text-loss">
                ▼
              </span>
              {biggestFaller.name} {biggestFaller.delta}
            </span>
          ) : null}
        </HubTile>

        <HubTile
          enterIndex={7}
          size="compact"
          href={`${base}/franchise/ownership`}
          title="Owner"
          stat={{ value: data.owner.patience, label: "Owner patience" }}
        >
          {data.owner.ownership.moodLabel}
          {objective ? (
            <span className="line-clamp-2 block text-warning">
              Goal: {objective.description}
            </span>
          ) : null}
          {data.owner.ownership.concern ? (
            <span className="line-clamp-2 block">
              {data.owner.ownership.concern}
            </span>
          ) : null}
        </HubTile>
      </FocusGrid>
    </div>
  );
}
