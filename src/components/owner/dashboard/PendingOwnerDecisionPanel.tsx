"use client";

import {
  acceptOwnerDecisionAction,
  askAiOwnerDecisionAction,
  declineOwnerDecisionAction,
} from "@/application/actions";
import { ActiveTeamBanner } from "@/components/game/ActiveTeamBanner";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { TeamBrandingView } from "@/state/team-branding-view";

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
};

/**
 * Blocks advance and asks the owner to Accept / Decline / Ask AI.
 */
export function PendingOwnerDecisionPanel(props: {
  saveId: string;
  returnPath: string;
  offer: PendingTradeOfferViewModel;
}) {
  const { offer } = props;

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
        Trade offer requires your decision
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
            {offer.receivingTeamName} receives
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
            {offer.offeringTeamName} receives
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

      <div className="mt-5 flex flex-wrap gap-2">
        <form action={acceptOwnerDecisionAction}>
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="decisionId" value={offer.decisionId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <button
            type="submit"
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-zinc-50 hover:bg-emerald-600"
          >
            Accept
          </button>
        </form>
        <form action={declineOwnerDecisionAction}>
          <input type="hidden" name="saveId" value={props.saveId} />
          <input type="hidden" name="decisionId" value={offer.decisionId} />
          <input type="hidden" name="returnPath" value={props.returnPath} />
          <button
            type="submit"
            className="rounded-md border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:border-zinc-400"
          >
            Decline
          </button>
        </form>
        {!offer.bothSidesOwned ? (
          <form action={askAiOwnerDecisionAction}>
            <input type="hidden" name="saveId" value={props.saveId} />
            <input type="hidden" name="decisionId" value={offer.decisionId} />
            <input type="hidden" name="returnPath" value={props.returnPath} />
            <button
              type="submit"
              className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
            >
              Ask AI
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
