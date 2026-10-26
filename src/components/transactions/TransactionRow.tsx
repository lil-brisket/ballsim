import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { splitDisplayName } from "@/presentation/portrait-hash";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { formatGameDate } from "@/presentation/game-date";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  transactionTypeLabel,
  type TransactionActivityMode,
  type TransactionRowView,
} from "@/state/transaction-hub-selectors";
import { cn, focusRingClass } from "@/components/ui/styles";

function badgeTone(type: string): string {
  switch (type) {
    case "PlayerTraded":
    case "DraftPickTraded":
      return "warning";
    case "FreeAgentSigned":
    case "ContractSigned":
      return "success";
    case "PlayerReleased":
    case "PlayerWaived":
    case "PlayerBoughtOut":
      return "critical";
    default:
      return "neutral";
  }
}

export function TransactionTypeBadge(props: {
  type: TransactionRowView["type"];
}) {
  return (
    <StatusBadge
      label={transactionTypeLabel(props.type)}
      tone={badgeTone(props.type)}
    />
  );
}

export function TransactionRow(props: {
  saveId: string;
  row: TransactionRowView;
  /** Accent the row (the user's team in a league-wide list). */
  highlight?: boolean;
  /** Off inside the timeline, whose date headings already show it. */
  showDate?: boolean;
}) {
  const { saveId, row } = props;
  const showDate = props.showDate ?? true;

  return (
    <article
      className={cn(
        "rounded-lg border px-3 py-3",
        props.highlight
          ? "border-team-ink/50 border-l-2 border-l-team-ink bg-team/15"
          : "border-zinc-800 bg-zinc-900/40",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <TransactionTypeBadge type={row.type} />
        {showDate ? (
          <span className="text-sm text-zinc-500">
            {formatGameDate(row.occurredOn)}
          </span>
        ) : null}
        {props.highlight ? (
          <span className="text-xs font-semibold uppercase tracking-wide text-team-ink">
            Your team
          </span>
        ) : null}
      </div>

      {row.tradeSides && row.tradeSides.length === 2 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {row.tradeSides.map((side) => (
            <div
              key={side.team.id}
              className="rounded-md border border-zinc-800/80 bg-zinc-950/40 px-3 py-2"
            >
              <p className="text-sm text-zinc-400">
                <TeamEntityLink
                  saveId={saveId}
                  teamId={side.team.id}
                  className={cn(
                    "font-medium text-zinc-200 hover:text-team-ink",
                    focusRingClass,
                  )}
                >
                  {side.team.abbreviation ?? side.team.name}
                </TeamEntityLink>{" "}
                acquired
              </p>
              <ul className="mt-1.5 space-y-1">
                {side.players.map((player) => (
                  <li key={player.id} className="flex items-center gap-2">
                    <PlayerPortrait
                      playerId={player.id}
                      portrait={player.portrait}
                      {...splitDisplayName(player.name)}
                      size="xs"
                    />
                    <PlayerEntityLink
                      saveId={saveId}
                      playerId={player.id}
                      className={cn(
                        "text-sm text-zinc-100 hover:text-team-ink",
                        focusRingClass,
                      )}
                    >
                      {player.name}
                    </PlayerEntityLink>
                  </li>
                ))}
                {side.assets.map((asset) => (
                  <li key={asset} className="text-sm text-zinc-400">
                    {asset}
                  </li>
                ))}
                {side.players.length === 0 && side.assets.length === 0 ? (
                  <li className="text-sm text-zinc-600">—</li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 space-y-1">
          <p className="text-sm text-zinc-200">{row.description}</p>
          <div className="flex flex-wrap gap-2 text-sm">
            {row.players.map((player) => (
              <span
                key={player.id}
                className="inline-flex items-center gap-1.5"
              >
                <PlayerPortrait
                  playerId={player.id}
                  portrait={player.portrait}
                  {...splitDisplayName(player.name)}
                  size="xs"
                />
                <PlayerEntityLink
                  saveId={saveId}
                  playerId={player.id}
                  className={cn(
                    "text-team-ink/90 hover:text-team-ink",
                    focusRingClass,
                  )}
                >
                  {player.name}
                </PlayerEntityLink>
              </span>
            ))}
            {row.teams.map((team) => (
              <TeamEntityLink
                key={team.id}
                saveId={saveId}
                teamId={team.id}
                className={cn(
                  "text-zinc-400 hover:text-team-ink",
                  focusRingClass,
                )}
              >
                {team.abbreviation ?? team.name}
              </TeamEntityLink>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export function TransactionTimeline(props: {
  saveId: string;
  groups: Array<{ date: string; rows: TransactionRowView[] }>;
  activityMode?: TransactionActivityMode;
  /** Accent rows involving the user's team. */
  highlightMyTeam?: boolean;
}) {
  if (props.groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      {props.activityMode === "myTeam" ? (
        <p className="text-sm text-zinc-400">Showing your franchise activity</p>
      ) : null}
      {props.groups.map((group) => (
        <section key={group.date} aria-label={group.date}>
          <div className="mb-2 flex items-center gap-3">
            <h3 className="font-display text-base font-semibold uppercase tracking-wide text-zinc-200">
              {formatGameDate(group.date, { year: true })}
            </h3>
            <span aria-hidden className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs text-zinc-500">
              {group.rows.length === 1
                ? "1 move"
                : `${group.rows.length} moves`}
            </span>
          </div>
          <ul className="space-y-2">
            {group.rows.map((row) => (
              <li key={row.id}>
                <TransactionRow
                  saveId={props.saveId}
                  row={row}
                  showDate={false}
                  highlight={Boolean(props.highlightMyTeam && row.isMyTeam)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
