"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import Link from "next/link";
import { executeTradeOfferAction } from "@/application/actions";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import { buttonClass } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn, focusRingClass } from "@/components/ui/styles";
import type {
  TradeAssetView,
  TradeInterestLevel,
  TradeOfferView,
} from "@/state/trade-offer-selectors";
import { OvrBadge } from "@/components/ui/OvrBadge";

const INTEREST_LABELS: Record<TradeInterestLevel, string> = {
  very_interested: "Very interested",
  interested: "Interested",
  open: "Open to it",
  lukewarm: "Lukewarm",
};

function assetSummary(asset: TradeAssetView): string {
  if (asset.kind === "player") {
    return `${asset.name} (${asset.position}, ${asset.overall} OVR)`;
  }
  return asset.viaAbbreviation
    ? `${asset.name} via ${asset.viaAbbreviation}`
    : asset.name;
}

function AssetColumn(props: { title: string; assets: TradeAssetView[] }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-line bg-surface-base/40 p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
        {props.title}
      </h4>
      {props.assets.length === 0 ? (
        <p className="text-sm text-faint">Nothing</p>
      ) : (
        <ul className="space-y-2">
          {props.assets.map((asset) => (
            <li key={`${asset.kind}-${asset.id}`} className="text-sm">
              {asset.kind === "player" ? (
                <>
                  <Link
                    href={asset.href}
                    className={cn(
                      "text-ink hover:text-team-ink",
                      focusRingClass,
                    )}
                  >
                    {asset.name}
                  </Link>
                  <p className="flex items-center gap-1.5 text-xs text-faint">
                    <span>{asset.position}</span>
                    <OvrBadge overall={asset.overall} size="sm" />
                    <span>
                      Age {asset.age}
                      {asset.salary !== null
                        ? ` · ${formatMoney(asset.salary)}`
                        : ""}
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <span className="text-ink">{asset.name}</span>
                  {asset.viaAbbreviation ? (
                    <span className="ml-2 text-xs text-faint">
                      via {asset.viaAbbreviation}
                    </span>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TradeOfferCard(props: {
  saveId: string;
  offer: TradeOfferView;
}) {
  const { offer, saveId } = props;
  return (
    <div className="space-y-4 rounded-xl border border-line bg-surface-raised/60 p-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SectionHeading
            as="h3"
            size="sm"
            titleClassName="text-lg!"
            title={offer.counterpartyName}
          />
          <span className="text-sm text-team-ink">
            {INTEREST_LABELS[offer.interestLevel]}
          </span>
        </div>
        <ProgressBar
          value={offer.interest}
          aria-label={`Interest ${Math.round(offer.interest)} of 100`}
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <AssetColumn title="You send" assets={offer.send} />
        <AssetColumn title="You receive" assets={offer.receive} />
      </div>
      <div className="flex justify-end">
        <ConfirmDialog
          title="Accept this trade"
          description={`Send ${offer.send.map(assetSummary).join(", ")} to ${offer.counterpartyName} for ${offer.receive.map(assetSummary).join(", ")}.`}
          confirmLabel="Accept trade"
        >
          <form action={executeTradeOfferAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <input
              type="hidden"
              name="proposalJson"
              value={JSON.stringify(offer.proposal)}
            />
            <input
              type="hidden"
              name="returnPath"
              value={`/dashboard/${saveId}/roster?tab=trade-finder`}
            />
            <button
              type="submit"
              className={buttonClass({ variant: "primary" })}
            >
              Confirm trade
            </button>
          </form>
        </ConfirmDialog>
      </div>
    </div>
  );
}
