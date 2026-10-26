import { resolveBoardDirectiveAction } from "@/application/actions";
import { buttonClass } from "@/components/ui/Button";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import { cn } from "@/components/ui/styles";
import type { OwnerDashboardOwner } from "@/state/owner-dashboard";

/**
 * The board's ultimatum with its two responses. Home shows it only while a
 * decision is pending; both responses are secondary so the hero keeps the one
 * primary action.
 */
export function BoardDirectiveCard(props: {
  board: OwnerDashboardOwner["ownership"]["board"];
  saveId: string;
}) {
  const { board, saveId } = props;
  if (!board.decisionPending) {
    return null;
  }
  return (
    <section
      aria-label="The board"
      role="alert"
      className={cn(
        "rounded-xl border px-4 py-3",
        board.stage === "warning"
          ? "border-warning/40 bg-warning/10"
          : "border-rose-900/60 bg-rose-950/20",
      )}
    >
      <p className="text-sm text-muted">The board</p>
      <p className="mt-1 text-sm font-medium text-ink">{board.label}</p>
      <p className="mt-1 text-sm text-soft">{board.detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={resolveBoardDirectiveAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="choice" value="accept_plan" />
          <button type="submit" className={buttonClass()}>
            Accept the turnaround plan
          </button>
        </form>
        <form action={resolveBoardDirectiveAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="choice" value="settle" />
          <button type="submit" className={buttonClass()}>
            Settle with the board ({formatMoney(board.settlementCost)})
          </button>
        </form>
      </div>
    </section>
  );
}
