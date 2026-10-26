import { restrictedFreeAgencyAction } from "@/application/actions";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/styles";
import { formatGameDate } from "@/presentation/game-date";
import type { IncomingOfferSheetRow } from "@/state/rfa-selectors";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Offer sheets other teams signed with your restricted free agents. */
export function IncomingOfferSheets(props: {
  sheets: IncomingOfferSheetRow[];
  saveId: string;
  returnPath: string;
}) {
  if (props.sheets.length === 0) return null;
  return (
    <ul className="space-y-3">
      {props.sheets.map((sheet) => {
        const overCap = sheet.payrollIfMatched > sheet.salaryCap;
        const blocked = sheet.matchBlockedReason !== null;
        return (
          <li
            key={sheet.playerId}
            className="space-y-3 rounded-lg border border-line px-4 py-3 text-sm"
          >
            <div className="space-y-1">
              <p className="text-ink">
                {sheet.playerName} signed an offer sheet with{" "}
                {sheet.offeringTeamName}: {formatMoney(sheet.salary)} a season
                for {plural(sheet.years, "season")}.
              </p>
              <p className="text-muted">
                Match by {formatGameDate(sheet.matchDeadlineDate)} or he joins
                them.
              </p>
              <p className={cn("text-muted", overCap && "text-rose-300")}>
                Payroll if matched {formatMoney(sheet.payrollIfMatched)} of{" "}
                {formatMoney(sheet.salaryCap)} cap
                {overCap ? ". Matching may go over the cap." : "."}
              </p>
              {blocked ? (
                <p role="alert" className="text-rose-300">
                  {sheet.matchBlockedReason}
                </p>
              ) : null}
            </div>
            <form
              action={restrictedFreeAgencyAction}
              className="flex flex-wrap gap-2"
            >
              <input type="hidden" name="saveId" value={props.saveId} />
              <input type="hidden" name="playerId" value={sheet.playerId} />
              <input type="hidden" name="returnPath" value={props.returnPath} />
              <Button
                type="submit"
                name="intent"
                value="match"
                variant="primary"
                disabled={blocked}
              >
                Match
              </Button>
              <Button
                type="submit"
                name="intent"
                value="decline"
                variant="danger"
              >
                Let him go
              </Button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
