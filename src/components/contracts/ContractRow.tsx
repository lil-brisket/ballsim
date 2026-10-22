import {
  declineTeamOptionAction,
  exerciseTeamOptionAction,
} from "@/application/actions";
import { ReleasePlayerDialog } from "@/components/contracts/ReleasePlayerDialog";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/components/ui/styles";
import type { ContractHubRow } from "@/state/contract-hub-selectors";

function statusTone(
  state: ContractHubRow["contractState"],
): "success" | "warning" | "critical" | "neutral" {
  switch (state) {
    case "option_pending":
    case "expiring":
    case "team_option":
    case "player_option":
      return "warning";
    case "expired":
      return "critical";
    default:
      return "neutral";
  }
}

function statusLabel(state: ContractHubRow["contractState"]): string {
  switch (state) {
    case "option_pending":
      return "Option pending";
    case "expiring":
      return "Expiring";
    case "team_option":
      return "Team option";
    case "player_option":
      return "Player option";
    case "expired":
      return "Expired";
    default:
      return "Active";
  }
}

/**
 * Contract table row.
 * Columns: Player → Salary → Years → Expiration → Option → Status → Action
 * Status and Action are intentionally separate.
 */
export function ContractRow(props: {
  saveId: string;
  row: ContractHubRow;
  returnPath: string;
}) {
  const { saveId, row, returnPath } = props;
  const actionable = row.hasPendingTeamOption;

  return (
    <tr
      className={cn(
        "border-t border-zinc-800",
        row.isExpiring && "bg-warning/10",
        row.isLargeCommitment && "font-medium",
      )}
    >
      <td className="px-3 py-2">
        <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
          {row.playerName}
        </PlayerEntityLink>
        <p className="text-sm text-zinc-500">
          {row.position}
          {row.age !== null ? ` · ${row.age}` : ""}
        </p>
      </td>
      <td className="px-3 py-2">
        {row.salary !== null ? <MoneyDisplay amount={row.salary} /> : "—"}
      </td>
      <td className="px-3 py-2 text-zinc-400">{row.yearsRemaining}y</td>
      <td className="px-3 py-2 text-zinc-300">{row.expirationYear}</td>
      <td className="px-3 py-2 text-sm text-zinc-400">{row.optionLabel}</td>
      <td className="px-3 py-2">
        <StatusBadge
          label={statusLabel(row.contractState)}
          tone={statusTone(row.contractState)}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {actionable ? (
            <>
              <ConfirmDialog
                title="Exercise team option"
                description={`Exercise the pending team option for ${row.playerName}.`}
                confirmLabel="Exercise"
              >
                <form action={exerciseTeamOptionAction}>
                  <input type="hidden" name="saveId" value={saveId} />
                  <input
                    type="hidden"
                    name="contractId"
                    value={row.contractId}
                  />
                  <input type="hidden" name="returnPath" value={returnPath} />
                  <button
                    type="submit"
                    className="rounded-md bg-team px-2.5 py-1 text-sm font-medium text-on-team"
                  >
                    Exercise
                  </button>
                </form>
              </ConfirmDialog>
              <ConfirmDialog
                title="Decline team option"
                description={`Decline the pending team option for ${row.playerName}.`}
                confirmLabel="Decline"
              >
                <form action={declineTeamOptionAction}>
                  <input type="hidden" name="saveId" value={saveId} />
                  <input
                    type="hidden"
                    name="contractId"
                    value={row.contractId}
                  />
                  <input type="hidden" name="returnPath" value={returnPath} />
                  <button
                    type="submit"
                    className="rounded-md border border-rose-700 px-2.5 py-1 text-sm text-rose-300"
                  >
                    Decline
                  </button>
                </form>
              </ConfirmDialog>
            </>
          ) : row.hasPendingPlayerOption ? (
            <span className="text-sm text-zinc-500">Player decision</span>
          ) : row.release === null ? (
            <span className="text-sm text-zinc-600">—</span>
          ) : null}
          {row.release !== null ? (
            <ReleasePlayerDialog
              saveId={saveId}
              playerId={row.playerId}
              playerName={row.playerName}
              returnPath={returnPath}
              release={row.release}
            />
          ) : null}
        </div>
      </td>
    </tr>
  );
}
