import { formatMoney } from "@/components/owner/MoneyDisplay";
import { formatGameDate } from "@/presentation/game-date";
import type { OutgoingOfferSheetRow } from "@/state/rfa-selectors";

/** Offer sheets your team has out for restricted free agents. */
export function OutgoingOfferSheets(props: {
  sheets: OutgoingOfferSheetRow[];
}) {
  if (props.sheets.length === 0) return null;
  return (
    <ul className="space-y-1 text-sm text-zinc-300">
      {props.sheets.map((sheet) => (
        <li key={sheet.playerId}>
          {sheet.playerName}: {sheet.originalTeamName} decide by{" "}
          {formatGameDate(sheet.matchDeadlineDate)} ({formatMoney(sheet.salary)}{" "}
          for {sheet.years}y)
        </li>
      ))}
    </ul>
  );
}
