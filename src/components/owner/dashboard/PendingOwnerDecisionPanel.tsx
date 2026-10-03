"use client";

import Link from "next/link";
import {
  acceptOwnerDecisionAction,
  askAiOwnerDecisionAction,
  declineOwnerDecisionAction,
} from "@/application/actions";
import { ActiveTeamBanner } from "@/components/game/ActiveTeamBanner";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { TeamBrandingView } from "@/state/team-branding-view";
import { cn, touchTargetClass } from "@/components/ui/styles";

export type PendingTradeOfferViewModel = {
  decisionId: string;
  offeringTeamName: string;
  offeringTeamBranding: TeamBrandingView | null;
  receivingTeamName: string;
  receivingTeamBranding: TeamBrandingView | null;
  bothSidesOwned: boolean;
  youReceive: string[];
  theyReceive: string[];
  primaryTeamId?: string;
  receivingTeamId?: string;
  offeringTeamId?: string;
  valueSummary?: "favor_receive" | "favor_send" | "even";
  motivationLabel?: string | null;
  reasons?: string[];
  expiresOn?: string | null;
};

function valueLabel(
  summary: PendingTradeOfferViewModel["valueSummary"],
): string {
  if (summary === "favor_receive") return "Favors You";
  if (summary === "favor_send") return "Favors Them";
  return "Even";
}

/**
 * Compact trade-offer interrupt panel: Accept / Review / Negotiate / Decline.
 */
export function PendingOwnerDecisionPanel(props: {
  saveId: string;
  returnPath: string;
  offer: PendingTradeOfferViewModel;
}) {
  const { offer } = props;
  const reviewHref = `/dashboard/${props.saveId}/trades/${offer.decisionId}`;
  const negotiateHref = `/dashboard/${props.saveId}/trades/${offer.decisionId}/negotiate`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-trade-title"
      className="space-y-3 rounded-md border border-amber-700/60 bg-amber-950/40 px-4 py-4 text-sm text-amber-100"
    >
      {offer.receivingTeamBranding ? (
        <ActiveTeamBanner
          city=""
          name={offer.receivingTeamName}
          branding={offer.receivingTeamBranding}
          actionLabel="Approving this trade as this franchise"
        />
      ) : null}
      <p className="text-xs uppercase tracking-wide text-amber-400/90">
        Simulation paused
      </p>
      <h3
        id="pending-trade-title"
        className="mt-1 text-lg font-medium text-amber-50"
      >
        {offer.offeringTeamName} Trade Offer
      </h3>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-amber-100/90">
        {offer.offeringTeamBranding ? (
          <span
            className="inline-flex shrink-0 items-center justify-center rounded-sm p-0.5"
            style={{
              backgroundColor: offer.offeringTeamBranding.primaryColor,
            }}
          >
            <TeamLogoMark
              branding={offer.offeringTeamBranding}
              size="sm"
              decorative
            />
          </span>
        ) : null}
        <span>
          <span className="font-medium text-amber-50">
            {offer.offeringTeamName}
          </span>
          {" → "}
          <span className="font-medium text-amber-50">
            {offer.receivingTeamName}
          </span>
        </span>
      </p>
      {offer.motivationLabel ? (
        <p className="text-xs text-amber-200/90">
          Why they&apos;re calling: {offer.motivationLabel}
        </p>
      ) : null}
      {offer.bothSidesOwned ? (
        <p className="mt-2 text-xs text-amber-200/90">
          You control both franchises in this trade. Approving applies both
          sides — there is no hidden automatic approval.
        </p>
      ) : (
        <p className="mt-2 text-amber-100/90">
          Simulation is paused until you decide.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-amber-800/50 bg-zinc-950/40 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            You Receive
          </p>
          <ul className="mt-1 list-inside list-disc text-zinc-200">
            {offer.youReceive.length === 0 ? (
              <li>Nothing</li>
            ) : (
              offer.youReceive.map((label) => <li key={label}>{label}</li>)
            )}
          </ul>
        </div>
        <div className="rounded-md border border-amber-800/50 bg-zinc-950/40 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            You Send
          </p>
          <ul className="mt-1 list-inside list-disc text-zinc-200">
            {offer.theyReceive.length === 0 ? (
              <li>Nothing</li>
            ) : (
              offer.theyReceive.map((label) => <li key={label}>{label}</li>)
            )}
          </ul>
        </div>
      </div>

      <p className="mt-3 text-sm font-medium text-amber-50">
        Trade: {valueLabel(offer.valueSummary)}
      </p>
      {offer.reasons && offer.reasons.length > 0 ? (
        <ul className="list-inside list-disc text-xs text-amber-200/80">
          {offer.reasons.slice(0, 3).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <form action={acceptOwnerDecisionAction} className="w-full sm:w-auto">
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="decisionId" value={offer.decisionId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <button
            type="submit"
            className={cn(
              touchTargetClass,
              "w-full rounded-md bg-emerald-700 px-3 text-sm font-medium text-zinc-50 hover:bg-emerald-600 sm:w-auto",
            )}
          >
            Accept
          </button>
        </form>
        <Link
          href={reviewHref}
          className={cn(
            touchTargetClass,
            "w-full rounded-md border border-amber-600/70 bg-amber-900/40 px-3 text-sm font-medium text-amber-50 hover:border-amber-400 sm:w-auto",
          )}
        >
          Review
        </Link>
        <Link
          href={negotiateHref}
          className={cn(
            touchTargetClass,
            "w-full rounded-md border border-zinc-500 px-3 text-sm text-zinc-100 hover:border-zinc-300 sm:w-auto",
          )}
        >
          Negotiate
        </Link>
        <form action={declineOwnerDecisionAction} className="w-full sm:w-auto">
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="decisionId" value={offer.decisionId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <button
            type="submit"
            className={cn(
              touchTargetClass,
              "w-full rounded-md border border-zinc-600 px-3 text-sm text-zinc-200 hover:border-zinc-400 sm:w-auto",
            )}
          >
            Decline
          </button>
        </form>
        {!offer.bothSidesOwned ? (
          <form action={askAiOwnerDecisionAction} className="w-full sm:w-auto">
            <input type="hidden" name="saveId" value={props.saveId} />
            <input type="hidden" name="decisionId" value={offer.decisionId} />
            <input type="hidden" name="returnPath" value={props.returnPath} />
            <button
              type="submit"
              className={cn(
                touchTargetClass,
                "w-full rounded-md bg-amber-600 px-3 text-sm font-medium text-zinc-950 hover:bg-amber-500 sm:w-auto",
              )}
            >
              Ask AI
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
