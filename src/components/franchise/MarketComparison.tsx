import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import type { DestinationEvaluation } from "@/state/market-destination";
import { MARKET_POTENTIAL_PER_POINT } from "@/state/franchise-value-config";

/** Destinations shown beside the current market. */
export const MARKET_COMPARISON_DESTINATIONS = 3;

/**
 * Current market beside the top relocation destinations. Potential is the
 * structural dollar ceiling from market size, not a predicted fill rate.
 */
export function MarketComparison(props: {
  currentCity: string;
  marketSize: number;
  attendanceRealization: number;
  destinations: readonly DestinationEvaluation[];
}) {
  const destinations = props.destinations.slice(
    0,
    MARKET_COMPARISON_DESTINATIONS,
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <ArenaPanel quiet as="div" className="border-team-ink/40">
        <p className="text-sm text-muted">Current market</p>
        <p className="mt-1 font-medium text-ink">{props.currentCity}</p>
        <ul className="mt-3 space-y-1 text-sm text-muted">
          <li className="flex justify-between gap-2">
            <span>Size</span>
            <span className="text-ink">{props.marketSize}</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>Potential</span>
            <MoneyDisplay
              amount={props.marketSize * MARKET_POTENTIAL_PER_POINT}
            />
          </li>
          <li className="flex justify-between gap-2">
            <span>Realization</span>
            <span className="text-ink">
              {Math.round(props.attendanceRealization * 100)}%
            </span>
          </li>
        </ul>
      </ArenaPanel>
      {destinations.map((destination) => (
        <ArenaPanel quiet as="div" key={destination.city}>
          <p className="text-sm text-muted">
            {destination.opportunity.replaceAll("_", " ")} opportunity
          </p>
          <p className="mt-1 font-medium text-ink">{destination.city}</p>
          <ul className="mt-3 space-y-1 text-sm text-muted">
            <li className="flex justify-between gap-2">
              <span>Size</span>
              <span className="text-ink">
                {destination.marketSize}{" "}
                <span
                  className={
                    destination.marketSizeDelta > 0
                      ? "text-success"
                      : destination.marketSizeDelta < 0
                        ? "text-danger"
                        : "text-faint"
                  }
                >
                  ({destination.marketSizeDelta > 0 ? "+" : ""}
                  {destination.marketSizeDelta})
                </span>
              </span>
            </li>
            <li className="flex justify-between gap-2">
              <span>Potential</span>
              <MoneyDisplay amount={destination.marketPotential} />
            </li>
            <li className="flex justify-between gap-2">
              <span>Risk</span>
              <span className="capitalize text-ink">
                {destination.risk.replaceAll("_", " ")}
              </span>
            </li>
          </ul>
          {destination.reasons[0] ? (
            <p className="mt-3 text-sm text-faint">{destination.reasons[0]}</p>
          ) : null}
        </ArenaPanel>
      ))}
    </div>
  );
}
