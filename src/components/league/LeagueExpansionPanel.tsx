import {
  approveExpansionAction,
  completeExpansionAction,
  proposeExpansionAction,
  runExpansionDraftAction,
} from "@/application/actions";
import type { ExpansionAssessment } from "@/state/expansion-assessment";
import type { ExpansionState } from "@/domain/entities/expansion";
import type { LeagueEconomy } from "@/domain/entities/league-economy";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { DataTable } from "@/components/ui/DataTable";
import { buttonClass } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { StatCard } from "@/components/ui/StatCard";
import { ErrorState } from "@/components/ui/EmptyState";

/**
 * Existing expansion + league economics UI — unchanged behavior.
 * Mounted at /league/expansion as a thin Phase 3 compatibility route.
 */
export function LeagueExpansionPanel(props: {
  saveId: string;
  returnPath: string;
  eco: LeagueEconomy;
  expansion: ExpansionState;
  assessment: ExpansionAssessment;
  error?: string;
}) {
  const { saveId, returnPath, eco, expansion, assessment, error } = props;
  const inProgress = assessment.status === "in_progress";
  const canPropose = assessment.status === "opportunity";

  return (
    <>
      <PageHeader
        title="League Expansion"
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
        <p className="mb-3 text-sm text-muted">
          Status:{" "}
          <span className="text-ink">
            {assessment.status.replaceAll("_", " ")}
          </span>
          {" · "}
          Fee: <MoneyDisplay amount={expansion.fee} />
          {expansion.newTeamId ? ` · New team: ${expansion.newTeamId}` : null}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line p-3 text-sm">
            <p className="font-medium text-ink">
              League readiness — {assessment.leagueReadiness.status}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
              {assessment.leagueReadiness.reasons.slice(0, 3).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-line p-3 text-sm">
            <p className="font-medium text-ink">
              Market opportunity — {assessment.marketOpportunity.status}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
              {assessment.marketOpportunity.reasons
                .slice(0, 3)
                .map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
            </ul>
          </div>
          <div className="rounded-lg border border-line p-3 text-sm">
            <p className="font-medium text-ink">
              Structural capacity — {assessment.structuralCapacity.status}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
              {assessment.structuralCapacity.reasons
                .slice(0, 3)
                .map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
            </ul>
          </div>
        </div>

        {assessment.marketOpportunity.destinations.length > 0 ? (
          <div className="mt-4">
            <DataTable
              caption="Candidate markets"
              headers={["Market", "Size", "Opportunity", "Risk"]}
            >
              {assessment.marketOpportunity.destinations
                .slice(0, 5)
                .map((destination) => (
                  <tr key={destination.city}>
                    <td className="px-3 py-2 text-ink">
                      {destination.city} {destination.name}
                    </td>
                    <td className="px-3 py-2">{destination.marketSize}</td>
                    <td className="px-3 py-2">
                      {destination.opportunity.replaceAll("_", " ")}
                    </td>
                    <td className="px-3 py-2">{destination.risk}</td>
                  </tr>
                ))}
            </DataTable>
          </div>
        ) : null}
      </Section>

      <Section title={`Expansion process (${expansion.stage})`}>
        {!canPropose && !inProgress ? (
          <p className="text-sm text-muted">
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
                  className={buttonClass({ variant: "secondary" })}
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
                  className={buttonClass({ variant: "secondary" })}
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
                  className={buttonClass({ variant: "secondary" })}
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
                  className={buttonClass({ variant: "primary" })}
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
