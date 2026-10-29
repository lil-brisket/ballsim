"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import Link from "next/link";
import { useState } from "react";
import { executeTradeOfferAction } from "@/application/actions";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import { buttonClass } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import { asDraftPickId, asPlayerId } from "@/domain/ids";
import { TRADE_OFFER_MAX_ASSETS_PER_SIDE } from "@/systems/trades-config";
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

function AssetColumn(props: {
  title: string;
  assets: TradeAssetView[];
  onRemove?: (asset: TradeAssetView) => void;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-lg border border-line bg-surface-base/40 p-3">
      <SectionHeading as="h4" size="xs" title={props.title} className="mb-2" />
      {props.assets.length === 0 ? (
        <p className="text-sm text-faint">Nothing</p>
      ) : (
        <ul className="space-y-2">
          {props.assets.map((asset) => (
            <li
              key={`${asset.kind}-${asset.id}`}
              className="flex items-start justify-between gap-2 text-sm"
            >
              <div className="min-w-0">
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
                    <p className="flex items-center gap-1.5 text-sm text-faint">
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
                      <span className="ml-2 text-sm text-faint">
                        via {asset.viaAbbreviation}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
              {props.onRemove ? (
                <button
                  type="button"
                  aria-label={`Remove ${asset.name}`}
                  onClick={() => props.onRemove?.(asset)}
                  className={cn(
                    touchTargetClass,
                    "shrink-0 text-faint hover:text-danger",
                    focusRingClass,
                  )}
                >
                  ✕
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const assetKeys = (assets: TradeAssetView[]) =>
  new Set(assets.map((a) => `${a.kind}-${a.id}`));

function sameAssets(a: TradeAssetView[], b: TradeAssetView[]): boolean {
  const keys = assetKeys(a);
  return (
    keys.size === a.length &&
    a.length === b.length &&
    b.every((x) => keys.has(`${x.kind}-${x.id}`))
  );
}

const withoutAsset = (assets: TradeAssetView[], asset: TradeAssetView) =>
  assets.filter((a) => !(a.kind === asset.kind && a.id === asset.id));

function toSide(
  teamId: TradeProposal["sideA"]["teamId"],
  assets: TradeAssetView[],
): TradeProposal["sideA"] {
  return {
    teamId,
    playerIds: assets
      .filter((a) => a.kind === "player")
      .map((a) => asPlayerId(a.id)),
    draftPickIds: assets
      .filter((a) => a.kind === "draftPick")
      .map((a) => asDraftPickId(a.id)),
  };
}

export function TradeOfferCard(props: {
  saveId: string;
  offer: TradeOfferView;
  /** Your tradable assets, offered as additions while modifying the offer. */
  ownAssets?: TradeAssetView[];
}) {
  const { offer, saveId } = props;
  const [editing, setEditing] = useState(false);
  const [send, setSend] = useState(offer.send);
  const [receive, setReceive] = useState(offer.receive);

  const max = TRADE_OFFER_MAX_ASSETS_PER_SIDE;
  const modified =
    !sameAssets(send, offer.send) || !sameAssets(receive, offer.receive);
  const proposal: TradeProposal = modified
    ? {
        sideA: toSide(offer.proposal.sideA.teamId, send),
        sideB: toSide(offer.proposal.sideB.teamId, receive),
      }
    : offer.proposal;
  const valid =
    send.length >= 1 &&
    send.length <= max &&
    receive.length >= 1 &&
    receive.length <= max;
  const addable = (props.ownAssets ?? []).filter(
    (asset) => !send.some((a) => a.kind === asset.kind && a.id === asset.id),
  );
  const reset = () => {
    setSend(offer.send);
    setReceive(offer.receive);
    setEditing(false);
  };

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
          {modified ? null : (
            <span className="text-sm text-team-ink">
              {INTEREST_LABELS[offer.interestLevel]}
            </span>
          )}
        </div>
        {modified ? (
          <p className="text-sm text-muted">
            Changed offer: {offer.counterpartyName} will decide when you propose
            it.
          </p>
        ) : (
          <ProgressBar
            value={offer.interest}
            aria-label={`Interest ${Math.round(offer.interest)} of 100`}
          />
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <AssetColumn
          title="You send"
          assets={send}
          onRemove={
            editing ? (asset) => setSend(withoutAsset(send, asset)) : undefined
          }
        />
        <AssetColumn
          title="You receive"
          assets={receive}
          onRemove={
            editing
              ? (asset) => setReceive(withoutAsset(receive, asset))
              : undefined
          }
        />
      </div>
      {editing ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            Remove assets from either side or add your own players and picks.
            Each side needs 1–{max} assets, and {offer.counterpartyName} may
            still turn the changed offer down.
          </p>
          {addable.length > 0 && send.length < max ? (
            <ul className="flex flex-wrap gap-2" aria-label="Add to your side">
              {addable.map((asset) => (
                <li key={`${asset.kind}-${asset.id}`}>
                  <button
                    type="button"
                    onClick={() => setSend([...send, asset])}
                    className={cn(
                      "min-h-11 rounded-full border border-line px-3 text-sm text-muted hover:border-disabled",
                      focusRingClass,
                    )}
                  >
                    + {asset.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {editing ? (
          <button
            type="button"
            className={buttonClass({ variant: "secondary" })}
            onClick={reset}
          >
            Cancel changes
          </button>
        ) : (
          <button
            type="button"
            className={buttonClass({ variant: "secondary" })}
            onClick={() => setEditing(true)}
          >
            Modify offer
          </button>
        )}
        <ConfirmDialog
          title={modified ? "Propose this trade" : "Accept this trade"}
          description={`Send ${send.map(assetSummary).join(", ")} to ${offer.counterpartyName} for ${receive.map(assetSummary).join(", ")}.`}
          confirmLabel={modified ? "Propose trade" : "Accept trade"}
        >
          <form action={executeTradeOfferAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <input
              type="hidden"
              name="proposalJson"
              value={JSON.stringify(proposal)}
            />
            <input
              type="hidden"
              name="returnPath"
              value={`/dashboard/${saveId}/roster?tab=trade-finder`}
            />
            <button
              type="submit"
              disabled={!valid}
              className={buttonClass({ variant: "primary" })}
            >
              {modified ? "Confirm proposal" : "Confirm trade"}
            </button>
          </form>
        </ConfirmDialog>
      </div>
    </div>
  );
}
