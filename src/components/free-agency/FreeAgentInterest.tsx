import { cn, focusRingClass } from "@/components/ui/styles";
import { formatMoney } from "@/components/owner/MoneyDisplay";

export type FreeAgentInterestProps = {
  caresAbout: string[];
  factors: { label: string; points: number }[];
  salaryToSign: number | null;
};

function formatPoints(points: number): string {
  const abs = Math.abs(points).toFixed(1);
  return `${points < 0 ? "−" : "+"}${abs}`;
}

export function FreeAgentInterest({
  caresAbout,
  factors,
  salaryToSign,
}: FreeAgentInterestProps) {
  const chips = factors.filter(
    (f) => Number(Math.abs(f.points).toFixed(1)) > 0,
  );
  return (
    <div className="mt-1 text-xs text-faint">
      {caresAbout.length > 0 ? (
        <p>Cares about: {caresAbout.join(", ")}</p>
      ) : null}
      <details className="mt-1">
        <summary
          className={cn(
            "inline-block cursor-pointer rounded text-muted hover:text-ink",
            focusRingClass,
          )}
        >
          Interest
        </summary>
        <div className="mt-1 space-y-1">
          {chips.length > 0 ? (
            <ul className="flex flex-wrap gap-1" aria-label="Interest factors">
              {chips.map((f) => (
                <li
                  key={f.label}
                  className={cn(
                    "rounded-full border px-2 py-0.5",
                    f.points > 0
                      ? "border-win/50 text-win"
                      : "border-loss/50 text-loss",
                  )}
                >
                  {formatPoints(f.points)} {f.label}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-soft">
            {salaryToSign === null
              ? "Not interested in your team right now."
              : `Would sign for about ${formatMoney(salaryToSign)}`}
          </p>
        </div>
      </details>
    </div>
  );
}
