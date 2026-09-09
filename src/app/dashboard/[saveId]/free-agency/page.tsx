import Link from "next/link";
import { notFound } from "next/navigation";
import {
  finishFreeAgencyAction,
  makeFreeAgentOfferAction,
  signFreeAgentAction,
  withdrawFreeAgentOfferAction,
} from "@/application/actions";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { Metric } from "@/components/ui/Metric";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { ManagementDecisionPanel } from "@/components/management/ManagementDecisionPanel";
import { toFreeAgencyHubView } from "@/state/free-agency-hub-selectors";

type FreeAgencyPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function FreeAgencyPage({
  params,
  searchParams,
}: FreeAgencyPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const loaded = await prismaSaveGameStore.load(saveId);
  if (!loaded) {
    notFound();
  }

  const hub = toFreeAgencyHubView(loaded.state);
  const returnPath = `/dashboard/${saveId}/free-agency`;
  const calendarHref = `/dashboard/${saveId}/calendar`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Free Agency"
        subtitle={
          hub.active
            ? `${hub.teamName} · Cap space available`
            : (hub.inactiveReason ?? "Offseason free agency")
        }
        actions={
          <Link
            href={calendarHref}
            className="rounded-md border border-amber-700/50 bg-amber-950/30 px-3 py-1.5 text-sm text-amber-200 hover:border-amber-600"
          >
            Open Calendar
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <div
        className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
        aria-label="Free agency summary"
      >
        <Metric
          label="Payroll"
          value={<MoneyDisplay amount={hub.playerPayroll} />}
          density="compact"
        />
        <Metric
          label="Cap space"
          value={<MoneyDisplay amount={hub.capSpace} />}
          density="compact"
        />
        <Metric
          label="Roster"
          value={String(hub.rosterCount)}
          density="compact"
        />
        <Metric
          label="Available"
          value={String(hub.availableCount)}
          density="compact"
        />
      </div>

      {!hub.active ? (
        <EmptyState message={hub.inactiveReason ?? "Free agency is not active."} />
      ) : (
        <>
          {hub.decisions.length > 0 ? (
            <ManagementDecisionPanel
              title="Free Agency Decisions"
              items={hub.decisions}
              saveId={saveId}
              currentDate={hub.currentDate}
            />
          ) : null}

          <Section title="My Offers">
            {hub.openOffers.length === 0 ? (
              <EmptyState message="No open offers from your team." />
            ) : (
              <ul className="space-y-2">
                {hub.openOffers.map((offer) => (
                  <li
                    key={offer.offerId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="text-zinc-100">
                        <PlayerEntityLink
                          saveId={saveId}
                          playerId={offer.playerId}
                        >
                          {offer.playerName}
                        </PlayerEntityLink>
                      </p>
                      <p className="text-zinc-500">
                        {offer.years}y ·{" "}
                        {offer.salary !== null ? (
                          <MoneyDisplay amount={offer.salary} />
                        ) : (
                          "—"
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge label={offer.status} />
                      <ConfirmDialog
                        title="Withdraw offer"
                        description={`Withdraw the open offer for ${offer.playerName}.`}
                        confirmLabel="Withdraw"
                      >
                        <form action={withdrawFreeAgentOfferAction}>
                          <input type="hidden" name="saveId" value={saveId} />
                          <input
                            type="hidden"
                            name="offerId"
                            value={offer.offerId}
                          />
                          <input
                            type="hidden"
                            name="returnPath"
                            value={returnPath}
                          />
                          <button
                            type="submit"
                            className="rounded-md border border-rose-700 px-3 py-1.5 text-sm text-rose-300"
                          >
                            Confirm withdraw
                          </button>
                        </form>
                      </ConfirmDialog>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Available Players">
            <p className="mb-2 text-xs text-zinc-500">
              Overall ratings shown match the existing free-agency information
              model (true OVR).
            </p>
            {hub.market.length === 0 ? (
              <EmptyState message="No free agents available." />
            ) : (
              <DataTable headers={["Player", "Pos", "Age", "OVR", "Actions"]}>
                {hub.market.slice(0, 40).map((agent) => (
                  <tr key={agent.playerId} className="border-t border-zinc-800">
                    <td className="px-3 py-2 text-zinc-100">
                      <PlayerEntityLink
                        saveId={saveId}
                        playerId={agent.playerId}
                      >
                        {agent.firstName} {agent.lastName}
                      </PlayerEntityLink>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{agent.position}</td>
                    <td className="px-3 py-2 text-zinc-400">{agent.age}</td>
                    <td className="px-3 py-2 text-zinc-200">{agent.overall}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-3">
                        <form
                          action={signFreeAgentAction}
                          className="flex gap-2"
                        >
                          <input type="hidden" name="saveId" value={saveId} />
                          <input
                            type="hidden"
                            name="playerId"
                            value={agent.playerId}
                          />
                          <input
                            type="hidden"
                            name="returnPath"
                            value={returnPath}
                          />
                          <input
                            type="number"
                            name="salary"
                            defaultValue={2_000_000}
                            className="w-28 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                            aria-label="Salary"
                          />
                          <input
                            type="number"
                            name="years"
                            defaultValue={1}
                            min={1}
                            className="w-14 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                            aria-label="Years"
                          />
                          <button
                            type="submit"
                            className="text-xs text-amber-400 hover:underline"
                          >
                            Sign
                          </button>
                        </form>
                        <form
                          action={makeFreeAgentOfferAction}
                          className="flex gap-2"
                        >
                          <input type="hidden" name="saveId" value={saveId} />
                          <input
                            type="hidden"
                            name="playerId"
                            value={agent.playerId}
                          />
                          <input
                            type="hidden"
                            name="returnPath"
                            value={returnPath}
                          />
                          <input type="hidden" name="salary" value={2_000_000} />
                          <input type="hidden" name="years" value={1} />
                          <button
                            type="submit"
                            className="text-xs text-zinc-400 hover:text-amber-400"
                          >
                            Offer
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Section>

          <Section title="Recent Signings">
            {hub.recentSignings.length === 0 ? (
              <EmptyState message="No accepted offers yet." />
            ) : (
              <ul className="space-y-2 text-sm">
                {hub.recentSignings.map((signing) => (
                  <li
                    key={signing.offerId}
                    className="flex flex-wrap justify-between gap-2 rounded-lg border border-zinc-800 px-4 py-2"
                  >
                    <PlayerEntityLink
                      saveId={saveId}
                      playerId={signing.playerId}
                    >
                      {signing.playerName}
                    </PlayerEntityLink>
                    <span className="text-zinc-500">
                      {signing.years}y ·{" "}
                      {signing.salary != null ? (
                        <MoneyDisplay amount={signing.salary} />
                      ) : (
                        "—"
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <details className="rounded-lg border border-zinc-800 px-4 py-3 text-sm text-zinc-400">
            <summary className="cursor-pointer text-zinc-300">
              Finish free agency (legacy domain action)
            </summary>
            <p className="mt-2 text-xs text-zinc-500">
              Prefers Calendar for progression. This pre-existing action advances
              the league phase and one simulation day.
            </p>
            <form action={finishFreeAgencyAction} className="mt-3">
              <input type="hidden" name="saveId" value={saveId} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <button
                type="submit"
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600"
              >
                Finish free agency
              </button>
            </form>
          </details>
        </>
      )}
    </div>
  );
}
