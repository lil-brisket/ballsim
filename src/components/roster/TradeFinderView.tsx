"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  executeTradeAction,
  listTradeCandidatesAction,
} from "@/application/actions";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import type {
  RosterPagePlayerView,
  TradeFinderRowView,
} from "@/state/roster-page-selectors";
import { EmptyState } from "@/components/owner/EmptyState";
import { DataTable } from "@/components/owner/DataTable";
import { cn, focusRingClass } from "@/components/ui/styles";

export function TradeFinderView(props: {
  saveId: string;
  roster: RosterPagePlayerView[];
  suggestedOutgoingPlayerId: string | null;
}) {
  const initial =
    props.suggestedOutgoingPlayerId ?? props.roster[0]?.playerId ?? "";
  const [outgoingPlayerId, setOutgoingPlayerId] = useState(initial);
  const [candidates, setCandidates] = useState<TradeFinderRowView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!outgoingPlayerId) {
      return;
    }
    let cancelled = false;
    startTransition(async () => {
      const result = await listTradeCandidatesAction(
        props.saveId,
        outgoingPlayerId,
      );
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        setError(result.error);
        setCandidates([]);
        return;
      }
      setError(null);
      setCandidates(result.candidates);
    });
    return () => {
      cancelled = true;
    };
  }, [props.saveId, outgoingPlayerId]);

  if (props.roster.length === 0) {
    return <EmptyState message="No roster players to trade." />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        Discover candidate trades for a roster player. Confirming a row
        executes that exact proposal — it does not re-search or swap a
        different player.
      </p>
      <label className="flex flex-col gap-1 text-xs text-zinc-500">
        Outgoing player
        <select
          value={outgoingPlayerId}
          onChange={(event) => {
            setOutgoingPlayerId(event.target.value);
            setCandidates([]);
            setError(null);
          }}
          className="max-w-md rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          {props.roster.map((player) => (
            <option key={player.playerId} value={player.playerId}>
              {player.firstName} {player.lastName} · {player.position} ·{" "}
              {player.overall} OVR
              {player.onTradeBlock ? " · on block" : ""}
            </option>
          ))}
        </select>
      </label>

      {pending ? (
        <p className="text-sm text-zinc-500">Searching trade block…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-rose-400" role="alert">
          {error}
        </p>
      ) : null}

      {!pending && !error && candidates.length === 0 ? (
        <EmptyState message="No acceptable trade candidates for this player." />
      ) : null}

      {candidates.length > 0 ? (
        <div className="overflow-x-auto">
          <DataTable
            headers={["Counterparty", "You send", "You receive", "Action"]}
          >
            {candidates.map((row, index) => (
              <tr
                key={`${row.counterpartyTeamId}-${index}`}
                className="border-t border-zinc-800"
              >
                <td className="px-3 py-2">
                  <span className="text-zinc-100">{row.counterpartyName}</span>
                  <span className="ml-2 font-mono text-xs text-zinc-500">
                    {row.counterpartyAbbreviation}
                  </span>
                </td>
                <td className="px-3 py-2 text-sm text-zinc-400">
                  {row.outgoingSummary}
                </td>
                <td className="px-3 py-2 text-sm text-zinc-300">
                  {row.incomingSummary}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <ConfirmDialog
                      title="Execute this trade"
                      description={`Send ${row.outgoingSummary} to ${row.counterpartyName} for ${row.incomingSummary}.`}
                      confirmLabel="Confirm this trade"
                    >
                      <form action={executeTradeAction}>
                        <input type="hidden" name="saveId" value={props.saveId} />
                        <input
                          type="hidden"
                          name="outgoingPlayerId"
                          value={outgoingPlayerId}
                        />
                        <input
                          type="hidden"
                          name="proposalJson"
                          value={JSON.stringify(row.proposal)}
                        />
                        <input
                          type="hidden"
                          name="returnPath"
                          value={`/dashboard/${props.saveId}/roster?tab=trade-finder`}
                        />
                        <button
                          type="submit"
                          className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
                        >
                          Execute
                        </button>
                      </form>
                    </ConfirmDialog>
                    <Link
                      href={row.reviewHref}
                      className={cn(
                        "text-xs text-zinc-500 hover:text-amber-300",
                        focusRingClass,
                      )}
                    >
                      Player
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      ) : null}
    </div>
  );
}
