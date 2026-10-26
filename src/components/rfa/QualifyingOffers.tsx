import { restrictedFreeAgencyAction } from "@/application/actions";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { QualifyingOfferRow } from "@/state/rfa-selectors";

/** Qualifying offer decisions for expiring players. */
export function QualifyingOffers(props: {
  rows: QualifyingOfferRow[];
  saveId: string;
  returnPath: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        A qualifying offer makes him a restricted free agent: you can match any
        offer sheet he signs.
      </p>
      <ul className="space-y-2">
        {props.rows.map((row) => (
          <li
            key={row.playerId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 text-sm"
          >
            <div>
              <p className="text-ink">{row.playerName}</p>
              <p className="text-faint">
                {row.position} · {row.age} · OVR {row.overall} · Offer{" "}
                <MoneyDisplay amount={row.qualifyingOfferSalary} />
              </p>
            </div>
            {row.issued ? (
              <StatusBadge label="Offer issued" tone="success" />
            ) : (
              <form
                action={restrictedFreeAgencyAction}
                className="flex flex-col items-end gap-1"
              >
                <input type="hidden" name="saveId" value={props.saveId} />
                <input type="hidden" name="playerId" value={row.playerId} />
                <input
                  type="hidden"
                  name="returnPath"
                  value={props.returnPath}
                />
                <input type="hidden" name="intent" value="issue_qo" />
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={row.blockedReason !== null}
                >
                  Issue qualifying offer
                </Button>
                {row.blockedReason ? (
                  <p className="max-w-xs text-right text-xs text-muted">
                    {row.blockedReason}
                  </p>
                ) : null}
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
