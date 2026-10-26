"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import type { ReactNode } from "react";
import type { TradeReviewView } from "@/state/trade-review-view";

function recommendationLabel(
  recommendation: TradeReviewView["recommendation"],
): string {
  if (recommendation === "favor_receive") return "Favors you";
  if (recommendation === "favor_send") return "Favors them";
  return "Roughly even";
}

function AssetColumn(props: {
  title: string;
  assets: TradeReviewView["youReceive"];
}) {
  return (
    <div className="rounded-md border border-line-strong bg-surface-base/50 px-4 py-3">
      <SectionHeading as="h3" title={props.title} />
      <ul className="mt-2 space-y-3">
        {props.assets.length === 0 ? (
          <li className="text-faint">Nothing</li>
        ) : (
          props.assets.map((asset) => (
            <li key={asset.id} className="rounded border border-line px-2 py-2">
              {asset.href ? (
                <Link
                  href={asset.href}
                  className="font-medium text-team-ink hover:underline"
                >
                  {asset.name}
                </Link>
              ) : (
                <p className="font-medium text-ink">{asset.name}</p>
              )}
              {asset.detail ? (
                <p className="text-sm text-muted">{asset.detail}</p>
              ) : null}
            </li>
          ))
        )}
      </ul>
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

      <div className="grid gap-4 md:grid-cols-2">
        <AssetColumn title="You receive" assets={review.youReceive} />
        <AssetColumn title="You send" assets={review.youSend} />
      </div>

      <section className="rounded-md border border-line-strong bg-surface-base/50 px-4 py-3">
        <SectionHeading as="h3" title="Evaluation" />
        <p className="mt-1 text-soft">
          {recommendationLabel(review.recommendation)} · Net value{" "}
          {review.netValue.toFixed(1)}
        </p>
        <ul className="mt-2 list-inside list-disc text-muted">
          {review.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm text-muted">
          <div>Roster fit {review.rosterFitPct}%</div>
          <div>Strategic fit {review.strategicFitPct}%</div>
          <div>Financial {review.financialPct}%</div>
        </div>
      </section>

      <section className="rounded-md border border-line-strong bg-surface-base/50 px-4 py-3">
        <SectionHeading as="h3" title="Roster impact" />
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-faint">
            <tr>
              <th className="py-1">Position</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {review.rosterImpact.map((row) => (
              <tr key={row.position} className="border-t border-line">
                <td className="py-1">{row.position}</td>
                <td>{row.before}</td>
                <td>{row.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {review.rosterImpact.some((row) => row.after > row.before) ? (
          <p className="mt-2 text-sm text-win">
            Incoming depth may push a player into the rotation.
          </p>
        ) : null}
      </section>

      {props.error ? (
        <p role="alert" className="text-sm text-red-300">
          {props.error}
        </p>
      ) : null}

      {showActions ? (
        <div className="flex flex-wrap gap-2">
          {props.onAccept ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onAccept}
              className={buttonClass({ variant: "primary" })}
            >
              Accept
            </button>
          ) : null}
          {props.onNegotiate ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onNegotiate}
              className={buttonClass({ variant: "secondary" })}
            >
              Negotiate
            </button>
          ) : props.negotiateHref ? (
            <Link
              href={props.negotiateHref}
              className={buttonClass({ variant: "secondary" })}
            >
              Negotiate
            </Link>
          ) : null}
          {props.onDecline ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onDecline}
              className={buttonClass({ variant: "secondary" })}
            >
              Decline
            </button>
          ) : null}
          {props.showLetAiDecide && props.onLetAiDecide ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onLetAiDecide}
              className={buttonClass({ variant: "secondary" })}
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
