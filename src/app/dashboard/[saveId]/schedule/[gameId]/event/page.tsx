import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cancelGameDayPromotionAction,
  changeGameDayPromotionAction,
  scheduleGameDayPromotionAction,
} from "@/application/actions";
import { loadOwnerGameDayPromotionEventView } from "@/application/game-service";
import { ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";

type PageProps = {
  params: Promise<{ saveId: string; gameId: string }>;
  searchParams: Promise<{ error?: string }>;
};

function formatMoneyRange(low: number, high: number): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  return `${fmt(low)} – ${fmt(high)}`;
}

export default async function GameDayEventPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId, gameId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerGameDayPromotionEventView(saveId, gameId);
  if (!view) {
    notFound();
  }

  const returnPath = `/dashboard/${saveId}/schedule/${gameId}/event`;

  return (
    <>
      <PageHeader
        title="Game-Day Event"
        subtitle={`${view.home ? "vs" : "@"} ${view.opponentName} · ${view.date}`}
      />
      <p className="mb-4 text-sm text-zinc-500">
        <Link
          href={`/dashboard/${saveId}/schedule`}
          className="text-amber-400 hover:text-amber-300"
        >
          ← Back to schedule
        </Link>
      </p>
      {error ? <ErrorState message={error} /> : null}

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-xs text-zinc-500">Business cash</div>
          <div className="text-lg text-zinc-100">
            <MoneyDisplay amount={view.businessFunds} />
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-xs text-zinc-500">Committed promotions</div>
          <div className="text-lg text-zinc-100">
            <MoneyDisplay amount={view.committedSpend} />
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-xs text-zinc-500">Matchup</div>
          <div className="text-lg text-zinc-100">
            {view.home ? "HOME" : "AWAY"} · {view.status}
          </div>
        </div>
      </section>

      {view.result ? (
        <Section title={`${view.result.name} Results`}>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Attendance</dt>
              <dd className="text-zinc-100">
                {view.result.actualAttendance.toLocaleString()} (expected without
                event: {view.result.baselineAttendance.toLocaleString()},{" "}
                {view.result.attendanceDifference >= 0 ? "+" : ""}
                {view.result.attendanceDifference.toLocaleString()})
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Projected attendance</dt>
              <dd className="text-zinc-100">
                {view.result.projectedAttendanceLow.toLocaleString()} –{" "}
                {view.result.projectedAttendanceHigh.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Event cost</dt>
              <dd className="text-zinc-100">
                <MoneyDisplay amount={view.result.eventCost} />
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Net event impact</dt>
              <dd
                className={
                  view.result.netFinancialImpact >= 0
                    ? "text-emerald-400"
                    : "text-rose-400"
                }
              >
                <MoneyDisplay amount={view.result.netFinancialImpact} />
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Projected net</dt>
              <dd className="text-zinc-100">
                {formatMoneyRange(
                  view.result.projectedNetImpactLow,
                  view.result.projectedNetImpactHigh,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Fan response</dt>
              <dd className="text-zinc-100 capitalize">
                {view.result.fanResponse.replaceAll("_", " ")}
                {view.result.underperformed ? (
                  <span className="ml-2 text-amber-400">(underperformed)</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Ticket revenue delta</dt>
              <dd className="text-zinc-100">
                <MoneyDisplay amount={view.result.ticketRevenueDifference} />
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Merch / concessions delta</dt>
              <dd className="text-zinc-100">
                <MoneyDisplay amount={view.result.merchRevenueDifference} /> /{" "}
                <MoneyDisplay
                  amount={view.result.concessionsRevenueDifference}
                />
              </dd>
            </div>
            {view.result.giveawaysDistributed != null ? (
              <div>
                <dt className="text-zinc-500">Giveaways distributed</dt>
                <dd className="text-zinc-100">
                  {view.result.giveawaysDistributed.toLocaleString()}
                  {view.result.giveawaysQuantity != null
                    ? ` / ${view.result.giveawaysQuantity.toLocaleString()}`
                    : ""}
                  {view.result.giveawaysSoldOut ? " · Sold out" : ""}
                </dd>
              </div>
            ) : null}
          </dl>
        </Section>
      ) : null}

      {view.home && view.currentPromotion ? (
        <Section title="Current event">
          <div className="space-y-3 text-sm">
            <p className="text-zinc-100">
              <span className="font-medium">{view.currentPromotion.name}</span>{" "}
              <span className="text-zinc-500">
                ({view.currentPromotion.status})
              </span>
            </p>
            <p className="text-zinc-400">
              Cost paid:{" "}
              <MoneyDisplay amount={view.currentPromotion.costPaid} />
            </p>
            {view.currentPromotion.projected ? (
              <p className="text-zinc-400">
                Projected attendance:{" "}
                {view.currentPromotion.projected.attendanceLow.toLocaleString()}{" "}
                –{" "}
                {view.currentPromotion.projected.attendanceHigh.toLocaleString()}
                <br />
                Projected net:{" "}
                {formatMoneyRange(
                  view.currentPromotion.projected.netImpactLow,
                  view.currentPromotion.projected.netImpactHigh,
                )}
              </p>
            ) : null}
            {view.status === "scheduled" ? (
              <form action={cancelGameDayPromotionAction} className="pt-2">
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="gameId" value={gameId} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-600 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  Remove event
                  {view.currentPromotion.refundFractionIfCancelled < 1
                    ? ` (${Math.round(view.currentPromotion.refundFractionIfCancelled * 100)}% refund)`
                    : " (full refund)"}
                </button>
              </form>
            ) : null}
          </div>
        </Section>
      ) : null}

      {view.home && view.status === "scheduled" && !view.result ? (
        <Section
          title={
            view.currentPromotion ? "Change event" : "Schedule a game-day event"
          }
        >
          <ul className="space-y-3">
            {view.catalog.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-100">{item.name}</div>
                    <div className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                      {item.category.replaceAll("_", " ")} ·{" "}
                      {item.leadTimeDays}d lead ·{" "}
                      <MoneyDisplay amount={item.cost} />
                    </div>
                    <p className="mt-2 text-sm text-zinc-400">
                      {item.description}
                    </p>
                    {item.projected ? (
                      <p className="mt-2 text-sm text-zinc-300">
                        Projected attendance:{" "}
                        {item.projected.attendanceLow.toLocaleString()} –{" "}
                        {item.projected.attendanceHigh.toLocaleString()}
                        <br />
                        Projected net:{" "}
                        {formatMoneyRange(
                          item.projected.netImpactLow,
                          item.projected.netImpactHigh,
                        )}
                      </p>
                    ) : null}
                    {!item.available && item.reason ? (
                      <p className="mt-2 text-xs text-rose-400">{item.reason}</p>
                    ) : null}
                  </div>
                  {item.available ? (
                    <form
                      action={
                        view.currentPromotion
                          ? changeGameDayPromotionAction
                          : scheduleGameDayPromotionAction
                      }
                    >
                      <input type="hidden" name="saveId" value={saveId} />
                      <input type="hidden" name="gameId" value={gameId} />
                      <input
                        type="hidden"
                        name="promotionId"
                        value={item.id}
                      />
                      <input
                        type="hidden"
                        name="returnPath"
                        value={returnPath}
                      />
                      <button
                        type="submit"
                        className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
                      >
                        {view.currentPromotion ? "Switch" : "Schedule"}
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {!view.home ? (
        <Section title="Away game">
          <p className="text-sm text-zinc-400">
            Game-day events can only be scheduled for home games.
          </p>
        </Section>
      ) : null}
    </>
  );
}
