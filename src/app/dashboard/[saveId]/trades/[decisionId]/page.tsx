import type { Metadata } from "next";
import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  acceptOwnerDecisionAction,
  declineOwnerDecisionAction,
} from "@/application/actions";
import { getRequestSaveStore } from "@/application/request-save-store";
import { TradeReviewPanel } from "@/components/trades/TradeReviewPanel";
import { buildTradeReviewView } from "@/state/trade-review-view";

export const metadata: Metadata = { title: "Trade" };

type PageProps = {
  params: Promise<{ saveId: string; decisionId: string }>;
};

export default async function TradeReviewPage(props: PageProps) {
  const { saveId, decisionId } = await props.params;
  const loaded = await getRequestSaveStore().load(saveId);
  if (!loaded) notFound();
  const review = buildTradeReviewView(loaded.state, decisionId);
  if (!review) notFound();

  const returnPath = `/dashboard/${saveId}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex justify-end">
        <Link
          href={returnPath}
          className={buttonClass({ variant: "secondary" })}
        >
          Back to dashboard
        </Link>
      </div>
      <TradeReviewPanel review={review} />
      <div className="flex flex-wrap gap-2">
        <form action={acceptOwnerDecisionAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="decisionId" value={decisionId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button type="submit" className={buttonClass({ variant: "primary" })}>
            Accept
          </button>
        </form>
        <Link
          href={`/dashboard/${saveId}/trades/${decisionId}/negotiate`}
          className={buttonClass({ variant: "secondary" })}
        >
          Negotiate
        </Link>
        <form action={declineOwnerDecisionAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="decisionId" value={decisionId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button
            type="submit"
            className={buttonClass({ variant: "secondary" })}
          >
            Decline
          </button>
        </form>
      </div>
    </div>
  );
}
