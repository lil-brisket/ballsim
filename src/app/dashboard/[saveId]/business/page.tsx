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
  const { forecast, lastGameDay, cashRunway } = biz;
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
        <StatCard
          label="Weekly marketing spend"
          value={<MoneyDisplay amount={biz.weeklyMarketingSpend} />}
        />
        <StatCard
          label="Cash runway"
          value={
            cashRunway.runwayWeeks === null
              ? "Stable"
              : `${cashRunway.runwayWeeks} weeks`
          }
        />
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
          <p className="mt-2 text-xs text-zinc-500">
            Awareness {biz.awareness} · weekly burn{" "}
            <MoneyDisplay amount={biz.weeklyMarketingSpend} />
          </p>
        </Section>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Section title="Forecast (next home game)">
          <p className="mb-3 text-xs text-zinc-500">
            Live estimate from current knobs — not a past result.
          </p>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li className="flex justify-between">
              <span>Demand score</span>
              <span>{forecast.demandScore}</span>
            </li>
            <li className="flex justify-between">
              <span>Expected attendance</span>
              <span>
                {forecast.attendance.toLocaleString()} /{" "}
                {forecast.capacity.toLocaleString()} ({forecast.fillRatePct}%)
              </span>
            </li>
            <li className="flex justify-between">
              <span>Ticket revenue</span>
              <MoneyDisplay amount={forecast.ticketRevenue} />
            </li>
            <li className="flex justify-between">
              <span>Merchandise</span>
              <MoneyDisplay amount={forecast.merchRevenue} />
            </li>
            <li className="flex justify-between">
              <span>Concessions</span>
              <MoneyDisplay amount={forecast.concessionsRevenue} />
            </li>
            <li className="flex justify-between font-medium text-zinc-100">
              <span>Total game-day</span>
              <MoneyDisplay amount={forecast.totalGameDayRevenue} />
            </li>
            <li className="flex justify-between">
              <span>Revenue / attendee</span>
              <span>
                {forecast.revenuePerAttendee === null ? (
                  "—"
                ) : (
                  <MoneyDisplay amount={forecast.revenuePerAttendee} />
                )}
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Demand contributors
          </p>
          <ul className="mt-1 space-y-1 text-xs text-zinc-400">
            {forecast.demandContributors.map((c) => (
              <li key={c.key} className="flex justify-between">
                <span>{c.key}</span>
                <span>{c.weighted}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Last home game (historical)">
          {lastGameDay === null ? (
            <p className="text-sm text-zinc-500">
              No settled home game yet. Advance time through a home date to
              record attendance.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-zinc-500">
                From HomeGameDaySettled on {lastGameDay.occurredOn} — not a
                forecast.
              </p>
              <ul className="space-y-2 text-sm text-zinc-300">
                <li className="flex justify-between">
                  <span>Attendance</span>
                  <span>
                    {lastGameDay.attendance.toLocaleString()} /{" "}
                    {lastGameDay.capacity.toLocaleString()} (
                    {lastGameDay.fillRatePct}%)
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Demand score</span>
                  <span>{lastGameDay.demandScore}</span>
                </li>
                <li className="flex justify-between">
                  <span>Ticket price</span>
                  <span>${lastGameDay.ticketPrice}</span>
                </li>
                <li className="flex justify-between">
                  <span>Tickets</span>
                  <MoneyDisplay amount={lastGameDay.ticketRevenue} />
                </li>
                <li className="flex justify-between">
                  <span>Merchandise</span>
                  <MoneyDisplay amount={lastGameDay.merchRevenue} />
                </li>
                <li className="flex justify-between">
                  <span>Concessions</span>
                  <MoneyDisplay amount={lastGameDay.concessionsRevenue} />
                </li>
                <li className="flex justify-between font-medium text-zinc-100">
                  <span>Total game-day</span>
                  <MoneyDisplay amount={lastGameDay.totalGameDayRevenue} />
                </li>
                <li className="flex justify-between">
                  <span>Revenue / attendee</span>
                  <span>
                    {lastGameDay.revenuePerAttendee === null ? (
                      "—"
                    ) : (
                      <MoneyDisplay amount={lastGameDay.revenuePerAttendee} />
                    )}
                  </span>
                </li>
              </ul>
            </>
          )}
        </Section>
      </div>
    </>
  );
}
