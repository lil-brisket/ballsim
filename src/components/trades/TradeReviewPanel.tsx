"use client";

import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import type { PortraitUniform } from "@/components/basketball/PortraitFace";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import { DataTable, numericCellClass } from "@/components/ui/DataTable";
import { OvrBadge } from "@/components/ui/OvrBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn, touchTargetTextClass } from "@/components/ui/styles";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatPositionLabel } from "@/presentation/position-label";
import type { TeamBrandingView } from "@/state/team-branding-view";
import type {
  TradeReviewAsset,
  TradeReviewView,
} from "@/state/trade-review-view";

function recommendationLabel(
  recommendation: TradeReviewView["recommendation"],
): string {
  if (recommendation === "favor_receive") return "Favors you";
  if (recommendation === "favor_send") return "Favors them";
  return "Roughly even";
}

const VERDICT_CLASS: Record<TradeReviewView["recommendation"], string> = {
  favor_receive: "border-win/40 bg-win/10 text-win",
  favor_send: "border-loss/40 bg-loss/10 text-loss",
  even: "border-line-strong bg-surface-raised/60 text-soft",
};

export function formatSignedNetValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = rounded.toFixed(1);
  return rounded > 0 ? `+${text}` : text;
}

function uniformOf(branding: TeamBrandingView | null): PortraitUniform | null {
  return branding
    ? {
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
      }
    : null;
}

function PlayerCard(props: {
  asset: TradeReviewAsset;
  uniform: PortraitUniform | null;
}) {
  const { asset } = props;
  const name = (
    <span className="font-medium">
      {asset.firstName} {asset.lastName}
    </span>
  );
  const facts = [
    asset.position
      ? formatPositionLabel(asset.position, asset.secondaryPosition)
      : null,
    asset.age != null ? `Age ${asset.age}` : null,
    asset.salary != null ? formatMoney(asset.salary) : null,
  ].filter((part): part is string => part != null);
  return (
    <li
      data-testid="trade-player-card"
      className="flex items-center gap-3 rounded-md border border-line bg-surface-raised/40 px-3 py-2"
    >
      <PlayerPortrait
        playerId={asset.playerId ?? asset.id}
        firstName={asset.firstName ?? ""}
        lastName={asset.lastName ?? ""}
        portrait={asset.portrait}
        uniform={props.uniform}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        {asset.href ? (
          <Link
            href={asset.href}
            className={cn(
              touchTargetTextClass,
              "px-0 text-team-ink hover:underline",
            )}
          >
            {name}
          </Link>
        ) : (
          <p className="text-ink">{name}</p>
        )}
        <p className="text-sm text-muted">{facts.join(" · ")}</p>
      </div>
      {asset.overall != null ? (
        <OvrBadge overall={asset.overall} size="sm" />
      ) : null}
    </li>
  );
}

function PickChip(props: { asset: TradeReviewAsset }) {
  return (
    <li
      data-testid="trade-pick-chip"
      className="rounded-full border border-line bg-surface-raised/40 px-3 py-1"
    >
      <span className="font-medium text-ink">{props.asset.name}</span>
      {props.asset.detail ? (
        <span className="block text-sm text-muted">{props.asset.detail}</span>
      ) : null}
    </li>
  );
}

function AssetColumn(props: {
  title: string;
  assets: TradeReviewView["youReceive"];
  branding: TeamBrandingView | null;
}) {
  const uniform = uniformOf(props.branding);
  const players = props.assets.filter(
    (asset) => asset.kind === "player" && asset.overall != null,
  );
  const picks = props.assets.filter((asset) => asset.kind === "pick");
  const others = props.assets.filter(
    (asset) => asset.kind === "player" && asset.overall == null,
  );
  return (
    <div className="rounded-md border border-line-strong bg-surface-base/50 px-4 py-3">
      <SectionHeading as="h3" title={props.title} />
      {props.assets.length === 0 ? (
        <p className="mt-2 text-faint">Nothing</p>
      ) : (
        <>
          <ul className="mt-2 space-y-2">
            {players.map((asset) => (
              <PlayerCard key={asset.id} asset={asset} uniform={uniform} />
            ))}
            {others.map((asset) => (
              <li key={asset.id} className="text-muted">
                {asset.name}
              </li>
            ))}
          </ul>
          {picks.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {picks.map((asset) => (
                <PickChip key={asset.id} asset={asset} />
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Centred balance bar: shaded even zone, centre tick, marker at the clamped net value. */
function BalanceBar(props: {
  recommendation: TradeReviewView["recommendation"];
  netValue: number;
  evenBand: number;
}) {
  const limit = props.evenBand * 3;
  const minValue = 0 - limit;
  const clamped = Math.min(limit, Math.max(-limit, props.netValue));
  const toPct = (value: number) => ((value + limit) / (2 * limit)) * 100;
  const evenLeft = toPct(-props.evenBand);
  const evenWidth = toPct(props.evenBand) - evenLeft;
  return (
    <div>
      <div
        role="meter"
        aria-label="Trade balance"
        aria-valuemin={minValue}
        aria-valuemax={limit}
        aria-valuenow={clamped}
        aria-valuetext={`${recommendationLabel(props.recommendation)}, net value ${formatSignedNetValue(props.netValue)}`}
        data-testid="trade-balance"
        className="relative h-3 w-full rounded-full bg-surface-high"
      >
        <div
          data-testid="trade-balance-even-zone"
          className="absolute inset-y-0 bg-surface-raised ring-1 ring-line-strong"
          style={{ left: `${evenLeft}%`, width: `${evenWidth}%` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
        <div
          data-testid="trade-balance-marker"
          className={cn(
            "absolute top-1/2 h-5 w-2 -translate-x-1/2 -translate-y-1/2 rounded-sm",
            props.recommendation === "favor_receive"
              ? "bg-win"
              : props.recommendation === "favor_send"
                ? "bg-loss"
                : "bg-ink",
          )}
          style={{ left: `${toPct(clamped)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-sm text-muted">
        <span>Favors them</span>
        <span>Favors you</span>
      </div>
    </div>
  );
}

function VerdictBanner(props: {
  recommendation: TradeReviewView["recommendation"];
  netValue: number;
}) {
  return (
    <div
      data-testid="trade-verdict"
      data-recommendation={props.recommendation}
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border px-4 py-3",
        VERDICT_CLASS[props.recommendation],
      )}
    >
      <p className="font-display text-2xl font-bold uppercase tracking-wide">
        {recommendationLabel(props.recommendation)}
      </p>
      <p className="text-right">
        <span className="block text-sm text-muted">Net value</span>
        <span
          data-testid="trade-net-value"
          className="font-display text-2xl font-bold tabular-nums"
        >
          {formatSignedNetValue(props.netValue)}
        </span>
      </p>
    </div>
  );
}

export function TradeReviewPanel(props: {
  review: TradeReviewView;
  busy?: boolean;
  error?: string | null;
  showLetAiDecide?: boolean;
  negotiateHref?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onLetAiDecide?: () => void;
  onNegotiate?: () => void;
  extraActions?: ReactNode;
}) {
  const { review } = props;
  const busy = props.busy === true;
  const showActions =
    props.onAccept != null ||
    props.onDecline != null ||
    props.onNegotiate != null ||
    props.negotiateHref != null ||
    props.onLetAiDecide != null ||
    props.extraActions != null;

  return (
    <div className="space-y-6 text-sm text-ink">
      <div>
        <SectionHeading
          id="owner-interrupt-title"
          eyebrow="Trade review"
          title={
            <>
              {review.offeringTeamName} → {review.receivingTeamName}
            </>
          }
        />
      </div>

      {review.motivationLabel ? (
        <p className="rounded-md border border-line-strong bg-surface-raised/60 px-3 py-2 text-soft">
          Why they&apos;re calling: {review.motivationLabel}
        </p>
      ) : null}

      {review.bothSidesOwned ? (
        <p className="text-sm text-ink/90">
          You control both franchises in this trade. Approving applies both
          sides — there is no hidden automatic approval.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
        <AssetColumn
          title="You receive"
          assets={review.youReceive}
          branding={review.offeringTeamBranding}
        />
        <div
          aria-hidden
          className="hidden w-px self-stretch bg-line-strong md:block"
        />
        <AssetColumn
          title="You send"
          assets={review.youSend}
          branding={review.receivingTeamBranding}
        />
      </div>

      <section className="space-y-3 rounded-md border border-line-strong bg-surface-base/50 px-4 py-3">
        <SectionHeading as="h3" title="Evaluation" />
        <VerdictBanner
          recommendation={review.recommendation}
          netValue={review.netValue}
        />
        <BalanceBar
          recommendation={review.recommendation}
          netValue={review.netValue}
          evenBand={review.evenBand}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <ProgressBar label="Roster fit" value={review.rosterFitPct} />
          <ProgressBar label="Strategic fit" value={review.strategicFitPct} />
          <ProgressBar label="Financial" value={review.financialPct} />
        </div>
        <ul className="list-inside list-disc text-muted">
          {review.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border border-line-strong bg-surface-base/50 px-4 py-3">
        <SectionHeading as="h3" title="Roster impact" />
        <div className="mt-2">
          <DataTable
            headers={[
              "Position",
              { label: "Before", numeric: true },
              { label: "After", numeric: true },
            ]}
          >
            {review.rosterImpact.map((row) => (
              <tr key={row.position}>
                <td className="px-3 py-2">{row.position}</td>
                <td className={`px-3 py-2 ${numericCellClass}`}>
                  {row.before}
                </td>
                <td className={`px-3 py-2 ${numericCellClass}`}>{row.after}</td>
              </tr>
            ))}
          </DataTable>
        </div>
        {review.rosterImpact.some((row) => row.after > row.before) ? (
          <p className="mt-2 text-sm text-win">
            Incoming depth may push a player into the rotation.
          </p>
        ) : null}
      </section>

      {props.error ? (
        <p role="alert" className="text-sm text-danger-ink">
          {props.error}
        </p>
      ) : null}

      {showActions ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {props.onAccept ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onAccept}
              className={cn(
                buttonClass({ variant: "primary", size: "lg" }),
                "w-full sm:w-auto",
              )}
            >
              Accept
            </button>
          ) : null}
          {props.onNegotiate ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onNegotiate}
              className={cn(
                buttonClass({ variant: "secondary" }),
                "w-full sm:w-auto",
              )}
            >
              Negotiate
            </button>
          ) : props.negotiateHref ? (
            <Link
              href={props.negotiateHref}
              className={cn(
                buttonClass({ variant: "secondary" }),
                "w-full sm:w-auto",
              )}
            >
              Negotiate
            </Link>
          ) : null}
          {props.onDecline ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onDecline}
              className={cn(
                buttonClass({ variant: "secondary" }),
                "w-full sm:w-auto",
              )}
            >
              Decline
            </button>
          ) : null}
          {props.showLetAiDecide && props.onLetAiDecide ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onLetAiDecide}
              className={cn(
                buttonClass({ variant: "secondary" }),
                "w-full sm:w-auto",
              )}
            >
              Let AI decide
            </button>
          ) : null}
          {props.extraActions}
        </div>
      ) : null}
    </div>
  );
}
