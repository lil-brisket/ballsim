import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { PendingOwnerDecisionPanel } from "@/components/owner/dashboard/PendingOwnerDecisionPanel";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { HubTile } from "@/components/ui/HubTile";
import { FocusGrid } from "@/components/ui/focus/FocusGrid";
import { SectionHeading } from "@/components/ui/SectionHeading";

export const metadata: Metadata = { title: "Trades" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Front Office › Trades landing: the offer waiting on you (if any), then the
 * ways to start a trade. Each fact lives on its own page; this only routes.
 */
export default async function TradesPage({ params, searchParams }: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const { ownerDashboard: dash, dashboard } = view;
  const base = `/dashboard/${saveId}`;
  const returnPath = `${base}/trades`;
  const shared = (dashboard.participation?.mode ?? "single") !== "single";
  const pending = dash.tradeInbox.totalPending;

  return (
    <div className="space-y-8">
      <SectionHeading as="h1" size="lg" title="Trades" />
      {error ? <ErrorState message={error} /> : null}

      <section aria-labelledby="trade-offers" className="space-y-3">
        <SectionHeading
          id="trade-offers"
          title={pending > 0 ? `Offers waiting (${pending})` : "Offers"}
        />
        {dash.pendingTradeOffer ? (
          <PendingOwnerDecisionPanel
            saveId={saveId}
            returnPath={returnPath}
            offer={dash.pendingTradeOffer}
          />
        ) : (
          <EmptyState message="No trade offers are waiting on you." />
        )}
      </section>

      <section aria-labelledby="trade-start" className="space-y-3">
        <SectionHeading id="trade-start" title="Start a trade" />
        <FocusGrid
          memoryKey="trades"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {shared ? (
            <HubTile
              enterIndex={0}
              title="Propose"
              href={`${base}/trades/propose`}
            >
              Offer a deal to another player in this league.
            </HubTile>
          ) : null}
          <HubTile
            enterIndex={shared ? 1 : 0}
            title="Trade finder"
            href={`${base}/roster?tab=trade-finder`}
          >
            Pick a player and see which teams are interested.
          </HubTile>
          <HubTile
            enterIndex={shared ? 2 : 1}
            title="Trade block"
            href={`${base}/roster?tab=trade-block`}
          >
            List players you are willing to move.
          </HubTile>
          <HubTile
            enterIndex={shared ? 3 : 2}
            title="Trade log"
            href={`${base}/league/transactions`}
          >
            Every trade and signing this season.
          </HubTile>
        </FocusGrid>
      </section>
    </div>
  );
}
