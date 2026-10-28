"use client";

import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import {
  acceptOwnerDecisionAction,
  askAiOwnerDecisionAction,
  declineOwnerDecisionAction,
} from "@/application/actions";
import { ActiveTeamBanner } from "@/components/game/ActiveTeamBanner";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { TeamBrandingView } from "@/state/team-branding-view";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/components/ui/styles";

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
    <section
      aria-labelledby="pending-trade-title"
      className="space-y-3 rounded-md border border-warning/40 bg-warning/10 px-4 py-4 text-sm text-ink"
    >
      {offer.receivingTeamBranding ? (
        <ActiveTeamBanner
          city=""
          name={offer.receivingTeamName}
          branding={offer.receivingTeamBranding}
          actionLabel="Approving this trade as this franchise"
        />
      ) : null}
      <SectionHeading
        id="pending-trade-title"
        eyebrow="Simulation paused"
        title={`${offer.offeringTeamName} trade offer`}
      />
      <p className="mt-2 flex flex-wrap items-center gap-2 text-ink">
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
          <span className="font-medium text-ink">{offer.offeringTeamName}</span>
          {" → "}
          <span className="font-medium text-ink">
            {offer.receivingTeamName}
          </span>
        </span>
      </p>
      {offer.motivationLabel ? (
        <p className="text-sm text-ink">
          Why they&apos;re calling: {offer.motivationLabel}
        </p>
      ) : null}
      {offer.bothSidesOwned ? (
        <p className="mt-2 text-sm text-ink">
          You control both franchises in this trade. Approving applies both
          sides — there is no hidden automatic approval.
        </p>
      ) : (
        <p className="mt-2 text-ink">Simulation is paused until you decide.</p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-warning/40 bg-surface-base/40 px-3 py-2">
          <p className="text-sm font-medium text-soft">You receive</p>
          <ul className="mt-1 list-inside list-disc text-ink">
            {offer.youReceive.length === 0 ? (
              <li>Nothing</li>
            ) : (
              offer.youReceive.map((label) => <li key={label}>{label}</li>)
            )}
          </ul>
        </div>
        <div className="rounded-md border border-warning/40 bg-surface-base/40 px-3 py-2">
          <p className="text-sm font-medium text-soft">You send</p>
          <ul className="mt-1 list-inside list-disc text-ink">
            {offer.theyReceive.length === 0 ? (
              <li>Nothing</li>
            ) : (
              offer.theyReceive.map((label) => <li key={label}>{label}</li>)
            )}
          </ul>
        </div>
      </div>

      <p className="mt-3 text-sm font-medium text-ink">
        Trade: {valueLabel(offer.valueSummary)}
      </p>
      {offer.reasons && offer.reasons.length > 0 ? (
        <ul className="list-inside list-disc text-sm text-soft">
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
              buttonClass({ variant: "primary" }),
              "w-full sm:w-auto",
            )}
          >
            Accept
          </button>
        </form>
        <Link
          href={reviewHref}
          className={cn(
            buttonClass({ variant: "secondary" }),
            "w-full sm:w-auto",
          )}
        >
          Review
        </Link>
        <Link
          href={negotiateHref}
          className={cn(
            buttonClass({ variant: "secondary" }),
            "w-full sm:w-auto",
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
              buttonClass({ variant: "secondary" }),
              "w-full sm:w-auto",
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
                buttonClass({ variant: "secondary" }),
                "w-full sm:w-auto",
              )}
            >
              Ask AI
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
