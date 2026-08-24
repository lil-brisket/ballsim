import { notFound } from "next/navigation";
import {
  approveExpansionAction,
  completeExpansionAction,
  proposeExpansionAction,
  runExpansionDraftAction,
} from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatCard } from "@/components/owner/StatCard";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function LeaguePage({ params, searchParams }: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }
  const eco = view.leagueEconomy;
  const expansion = view.expansion;
  const assessment = view.expansionAssessment;
  const returnPath = `/dashboard/${saveId}/league`;
  const inProgress = assessment.status === "in_progress";
  const canPropose = assessment.status === "opportunity";

  return (
    <>
      <PageHeader
        title="League"
        subtitle="League economics and expansion opportunity"
      />
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Popularity" value={`${eco.popularity}`} />
        <StatCard label="Broadcast value" value={`${eco.broadcastValue}`} />
        <StatCard
          label="Sponsorship climate"
          value={`${eco.sponsorshipClimate}`}
        />
        <StatCard label="Cycle" value={eco.cycle} />
        <StatCard
          label="Revenue sharing"
          value={`${Math.round(eco.revenueSharingRate * 100)}%`}
        />
      </section>

      <Section title="Expansion assessment">
        <p className="mb-3 text-sm text-zinc-400">
          Status:{" "}
          <span className="text-zinc-200">
            {assessment.status.replaceAll("_", " ")}
          </span>
          {" · "}
          Fee: <MoneyDisplay amount={expansion.fee} />
          {expansion.newTeamId ? ` · New team: ${expansion.newTeamId}` : null}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 p-3 text-sm">
            <p className="font-medium text-zinc-200">
              League readiness — {assessment.leagueReadiness.status}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-zinc-400">
              {assessment.leagueReadiness.reasons.slice(0, 3).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-zinc-800 p-3 text-sm">
            <p className="font-medium text-zinc-200">
              Market opportunity — {assessment.marketOpportunity.status}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-zinc-400">
              {assessment.marketOpportunity.reasons.slice(0, 3).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-zinc-800 p-3 text-sm">
            <p className="font-medium text-zinc-200">
              Structural capacity — {assessment.structuralCapacity.status}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-zinc-400">
              {assessment.structuralCapacity.reasons.slice(0, 3).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </div>

        {assessment.marketOpportunity.destinations.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm text-zinc-300">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">Market</th>
                  <th className="py-1 pr-3 font-medium">Size</th>
                  <th className="py-1 pr-3 font-medium">Opportunity</th>
                  <th className="py-1 pr-3 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {assessment.marketOpportunity.destinations
                  .slice(0, 5)
                  .map((destination) => (
                    <tr
                      key={destination.city}
                      className="border-t border-zinc-800"
                    >
                      <td className="py-1.5 pr-3">
                        {destination.city} {destination.name}
                      </td>
                      <td className="py-1.5 pr-3">{destination.marketSize}</td>
                      <td className="py-1.5 pr-3">
                        {destination.opportunity.replaceAll("_", " ")}
                      </td>
                      <td className="py-1.5 pr-3">{destination.risk}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Section>

      <Section title={`Expansion process (${expansion.stage})`}>
        {!canPropose && !inProgress ? (
          <p className="text-sm text-zinc-400">
            Expansion is not an active league opportunity. All three gates must
            open before proposing a new franchise.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {canPropose ? (
              <form action={proposeExpansionAction}>
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600"
                >
                  Propose expansion
                </button>
              </form>
            ) : null}
            {expansion.candidates.map((candidate, index) => (
              <form
                key={`${candidate.city}-${index}`}
                action={approveExpansionAction}
              >
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="candidateIndex" value={index} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600"
                >
                  Approve {candidate.city} {candidate.name}
                </button>
              </form>
            ))}
            {expansion.newTeamId ? (
              <form action={runExpansionDraftAction}>
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600"
                >
                  Run expansion draft
                </button>
              </form>
            ) : null}
            {inProgress ? (
              <form action={completeExpansionAction}>
                <input type="hidden" name="saveId" value={saveId} />
                <input type="hidden" name="returnPath" value={returnPath} />
                <button
                  type="submit"
                  className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
                >
                  Complete expansion
                </button>
              </form>
            ) : null}
          </div>
        )}
      </Section>
    </>
  );
}
