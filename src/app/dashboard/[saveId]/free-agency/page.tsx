import { notFound } from "next/navigation";
import {
  finishFreeAgencyAction,
  makeFreeAgentOfferAction,
  signFreeAgentAction,
  withdrawFreeAgentOfferAction,
} from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { ConfirmDialog } from "@/components/owner/ConfirmDialog";
import { DataTable } from "@/components/owner/DataTable";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatusBadge } from "@/components/owner/StatusBadge";

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
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const returnPath = `/dashboard/${saveId}/free-agency`;
  const active =
    view.phaseDashboard.resolved.phaseId === "offseason.free_agency";

  return (
    <>
      <PageHeader
        title="Free Agency"
        subtitle={
          active
            ? `Cap space ${view.dashboard.capSpace.toLocaleString()} · Cash available`
            : "Available during offseason free_agency stage"
        }
        actions={
          active ? (
            <form action={finishFreeAgencyAction}>
              <input type="hidden" name="saveId" value={saveId} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <button
                type="submit"
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600"
              >
                Finish free agency → Draft
              </button>
            </form>
          ) : undefined
        }
      />
      {error ? <ErrorState message={error} /> : null}

      {!active ? (
        <EmptyState message="Free agency is not active. Advance the season until the free_agency offseason stage." />
      ) : (
        <>
          <Section title="Pending offers">
            {view.openFreeAgencyOffers.length === 0 ? (
              <EmptyState message="No open offers from your team." />
            ) : (
              <ul className="space-y-2">
                {view.openFreeAgencyOffers.map((offer) => (
                  <li
                    key={offer.offerId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="text-zinc-100">{offer.playerName}</p>
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

          <Section title="Available free agents">
            {view.freeAgents.length === 0 ? (
              <EmptyState message="No free agents available." />
            ) : (
              <DataTable
                headers={["Player", "Pos", "Age", "OVR", "Actions"]}
              >
                {view.freeAgents.slice(0, 40).map((agent) => (
                  <tr
                    key={agent.playerId}
                    className="border-t border-zinc-800"
                  >
                    <td className="px-3 py-2 text-zinc-100">
                      {agent.firstName} {agent.lastName}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">
                      {agent.position}
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{agent.age}</td>
                    <td className="px-3 py-2 text-zinc-200">
                      {agent.overall}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-3">
                        <form action={signFreeAgentAction} className="flex gap-2">
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
        </>
      )}
    </>
  );
}
