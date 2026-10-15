import Link from "next/link";
import { notFound } from "next/navigation";
import {
  acceptOwnerDecisionAction,
  declineOwnerDecisionAction,
} from "@/application/actions";
import { getRequestSaveStore } from "@/application/request-save-store";
import { TradeReviewPanel } from "@/components/trades/TradeReviewPanel";
import { buildTradeReviewView } from "@/state/trade-review-view";

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
          className="rounded-md border border-zinc-600 px-3 py-1.5 text-zinc-200 hover:border-zinc-400"
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
          <button
            type="submit"
            className="rounded-md bg-emerald-700 px-3 py-1.5 font-medium text-zinc-50 hover:bg-emerald-600"
          >
            Accept
          </button>
        </form>
        <Link
          href={`/dashboard/${saveId}/trades/${decisionId}/negotiate`}
          className="rounded-md border border-zinc-500 px-3 py-1.5 text-zinc-100 hover:border-zinc-300"
        >
          Negotiate
        </Link>
        <form action={declineOwnerDecisionAction}>
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="decisionId" value={decisionId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <button
            type="submit"
            className="rounded-md border border-zinc-600 px-3 py-1.5 text-zinc-200 hover:border-zinc-400"
          >
            Decline
          </button>
        </form>
      </div>
    </div>
  );
}
