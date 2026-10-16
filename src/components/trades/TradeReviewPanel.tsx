"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { TradeReviewView } from "@/state/trade-review-view";
import { cn, touchTargetClass } from "@/components/ui/styles";

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
    <div className="rounded-md border border-zinc-700 bg-zinc-950/50 px-4 py-3">
      <h2 className="text-base font-medium text-zinc-50">{props.title}</h2>
      <ul className="mt-2 space-y-3">
        {props.assets.length === 0 ? (
          <li className="text-zinc-500">Nothing</li>
        ) : (
          props.assets.map((asset) => (
            <li
              key={asset.id}
              className="rounded border border-zinc-800 px-2 py-2"
            >
              {asset.href ? (
                <Link
                  href={asset.href}
                  className="font-medium text-team-ink hover:underline"
                >
                  {asset.name}
                </Link>
              ) : (
                <p className="font-medium text-zinc-100">{asset.name}</p>
              )}
              {asset.detail ? (
                <p className="text-xs text-zinc-400">{asset.detail}</p>
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
    <div className="space-y-6 text-sm text-zinc-200">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Trade review
        </p>
        <h2
          id="owner-interrupt-title"
          className="text-2xl font-semibold text-zinc-50"
        >
          {review.offeringTeamName} → {review.receivingTeamName}
        </h2>
      </div>

      {review.motivationLabel ? (
        <p className="rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-zinc-300">
          Why they&apos;re calling: {review.motivationLabel}
        </p>
      ) : null}

      {review.bothSidesOwned ? (
        <p className="text-xs text-zinc-200/90">
          You control both franchises in this trade. Approving applies both
          sides — there is no hidden automatic approval.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <AssetColumn title="You receive" assets={review.youReceive} />
        <AssetColumn title="You send" assets={review.youSend} />
      </div>

      <section className="rounded-md border border-zinc-700 bg-zinc-950/50 px-4 py-3">
        <h3 className="text-base font-medium text-zinc-50">Evaluation</h3>
        <p className="mt-1 text-zinc-300">
          {recommendationLabel(review.recommendation)} · Net value{" "}
          {review.netValue.toFixed(1)}
        </p>
        <ul className="mt-2 list-inside list-disc text-zinc-400">
          {review.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-400">
          <div>Roster fit {review.rosterFitPct}%</div>
          <div>Strategic fit {review.strategicFitPct}%</div>
          <div>Financial {review.financialPct}%</div>
        </div>
      </section>

      <section className="rounded-md border border-zinc-700 bg-zinc-950/50 px-4 py-3">
        <h3 className="text-base font-medium text-zinc-50">Roster impact</h3>
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-1">Position</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {review.rosterImpact.map((row) => (
              <tr key={row.position} className="border-t border-zinc-800">
                <td className="py-1">{row.position}</td>
                <td>{row.before}</td>
                <td>{row.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {review.rosterImpact.some((row) => row.after > row.before) ? (
          <p className="mt-2 text-xs text-emerald-300/90">
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
              className={cn(
                touchTargetClass,
                "rounded-md bg-emerald-700 px-3 text-sm font-medium text-zinc-50 hover:bg-emerald-600 disabled:opacity-50",
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
                touchTargetClass,
                "rounded-md border border-zinc-500 px-3 text-sm text-zinc-100 hover:border-zinc-300 disabled:opacity-50",
              )}
            >
              Negotiate
            </button>
          ) : props.negotiateHref ? (
            <Link
              href={props.negotiateHref}
              className={cn(
                touchTargetClass,
                "rounded-md border border-zinc-500 px-3 text-sm text-zinc-100 hover:border-zinc-300",
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
                touchTargetClass,
                "rounded-md border border-zinc-600 px-3 text-sm text-zinc-200 hover:border-zinc-400 disabled:opacity-50",
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
                touchTargetClass,
                "rounded-md bg-team px-3 text-sm font-medium text-on-team hover:brightness-110 disabled:opacity-50",
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
