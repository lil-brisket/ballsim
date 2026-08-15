import Link from "next/link";
import { setMarketingBudgetAction, setTicketPriceAction } from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { notFound } from "next/navigation";
import { ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatCard } from "@/components/owner/StatCard";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** Marketing / business ops — same actions as former Business page. */
export default async function MarketingPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }
  const biz = view.franchiseBusiness;
  const returnPath = `/dashboard/${saveId}/business`;

  return (
    <>
      <PageHeader
        title="Marketing"
        subtitle="Ticket pricing, marketing budget, fan sentiment, and reputation"
      />
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Fan sentiment" value={`${biz.fanSentiment}`} />
        <StatCard label="Awareness" value={`${biz.awareness}`} />
        <StatCard label="Media attention" value={`${biz.mediaAttention}`} />
        <StatCard label="Reputation" value={`${biz.reputation}`} />
        <StatCard label="Market size" value={`${biz.marketSize}`} />
        <StatCard label="Arena capacity" value={`${biz.arenaCapacity}`} />
        <StatCard
          label="Franchise value"
          value={<MoneyDisplay amount={biz.franchiseValue} />}
        />
        <StatCard label="Ticket price" value={`$${biz.ticketPrice}`} />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Ticket pricing">
          <form action={setTicketPriceAction} className="flex flex-wrap gap-3">
            <input type="hidden" name="saveId" value={saveId} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <input
              type="number"
              name="ticketPrice"
              defaultValue={biz.ticketPrice}
              min={10}
              max={250}
              className="w-28 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            />
            <button
              type="submit"
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              Set price
            </button>
          </form>
        </Section>

        <Section title="Marketing budget (annual)">
          <form
            action={setMarketingBudgetAction}
            className="flex flex-wrap gap-3"
          >
            <input type="hidden" name="saveId" value={saveId} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <input
              type="number"
              name="budget"
              defaultValue={biz.marketingBudget}
              min={0}
              step={100000}
              className="w-40 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            />
            <button
              type="submit"
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              Set budget
            </button>
          </form>
        </Section>
      </div>
    </>
  );
}
