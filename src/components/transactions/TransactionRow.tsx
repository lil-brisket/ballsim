import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { StatusBadge } from "@/components/owner/StatusBadge";
import {
  transactionTypeLabel,
  type TransactionRowView,
} from "@/state/transaction-hub-selectors";
import { cn, focusRingClass } from "@/components/ui/styles";

function badgeTone(type: string): string {
  switch (type) {
    case "PlayerTraded":
      return "warning";
    case "FreeAgentSigned":
    case "ContractSigned":
      return "success";
    case "PlayerReleased":
      return "critical";
    default:
      return "neutral";
  }
}

export function TransactionTypeBadge(props: { type: TransactionRowView["type"] }) {
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
}) {
  const { saveId, row } = props;

  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <TransactionTypeBadge type={row.type} />
        <span className="font-mono text-[0.65rem] text-zinc-600">
          {row.occurredOn}
        </span>
      </div>

      {row.tradeSides && row.tradeSides.length === 2 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {row.tradeSides.map((side) => (
            <div
              key={side.team.id}
              className="rounded-md border border-zinc-800/80 bg-zinc-950/40 px-3 py-2"
            >
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                <TeamEntityLink
                  saveId={saveId}
                  teamId={side.team.id}
                  className={cn(
                    "font-medium text-zinc-200 hover:text-amber-400",
                    focusRingClass,
                  )}
                >
                  {side.team.abbreviation ?? side.team.name}
                </TeamEntityLink>{" "}
                acquired
              </p>
              <ul className="mt-1.5 space-y-1">
                {side.players.map((player) => (
                  <li key={player.id}>
                    <PlayerEntityLink
                      saveId={saveId}
                      playerId={player.id}
                      className={cn(
                        "text-sm text-zinc-100 hover:text-amber-400",
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
              <PlayerEntityLink
                key={player.id}
                saveId={saveId}
                playerId={player.id}
                className={cn(
                  "text-amber-400/90 hover:text-amber-300",
                  focusRingClass,
                )}
              >
                {player.name}
              </PlayerEntityLink>
            ))}
            {row.teams.map((team) => (
              <TeamEntityLink
                key={team.id}
                saveId={saveId}
                teamId={team.id}
                className={cn(
                  "text-zinc-400 hover:text-amber-400",
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
}) {
  if (props.groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {props.groups.map((group) => (
        <section key={group.date} aria-label={group.date}>
          <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
            {formatDateHeader(group.date)}
          </h2>
          <ul className="space-y-2">
            {group.rows.map((row) => (
              <li key={row.id}>
                <TransactionRow saveId={props.saveId} row={row} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function formatDateHeader(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const utc = new Date(Date.UTC(y!, m! - 1, d!, 12, 0, 0));
    return utc.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).toUpperCase();
  } catch {
    return iso;
  }
}
