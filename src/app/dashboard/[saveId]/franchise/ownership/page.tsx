import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadFranchiseOwnershipView } from "@/application/game-service";
import { FranchiseSubNav } from "@/components/franchise/FranchiseSubNav";
import { ObjectiveCard } from "@/components/game/ObjectiveCard";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Section } from "@/components/ui/Section";
import { StatCard } from "@/components/ui/StatCard";
import { cn, linkClass } from "@/components/ui/styles";

export const metadata: Metadata = { title: "Ownership" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Franchise Ownership tab — ownership mood, board pressure, mood by season
 * and the owner objective record. Read-only: the board's decision is
 * resolved from the Front Office.
 */
export default async function FranchiseOwnershipPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadFranchiseOwnershipView(saveId);
  if (!view) {
    notFound();
  }
  const { confidence, totals } = view;
  const resolved = totals.completed + totals.failed;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Franchise"
        subtitle={`Ownership · ${confidence.philosophy}`}
      />
      <FranchiseSubNav saveId={saveId} active="ownership" />
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ownership mood"
          value={confidence.moodLabel}
          density="compact"
        />
        <StatCard
          label="Alignment"
          value={`${confidence.alignmentScore}%`}
          density="compact"
        />
        <StatCard
          label="Board"
          value={confidence.board.label}
          density="compact"
        />
        <StatCard
          label="Objectives met"
          value={resolved === 0 ? "—" : `${totals.completed}/${resolved}`}
          density="compact"
        />
      </section>

      <Section title="Mandate">
        <p className="text-sm text-soft">{confidence.mandateSummary}</p>
        {confidence.priorityBullets.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {confidence.priorityBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3">
          <ProgressBar
            value={confidence.alignmentScore}
            max={100}
            label="Alignment"
          />
        </div>
        {confidence.concern ? (
          <p className="mt-3 text-sm text-warning">{confidence.concern}</p>
        ) : null}
      </Section>

      <Section title="The Board">
        <p className="text-sm font-medium text-ink">{confidence.board.label}</p>
        <p className="mt-1 text-sm text-muted">{confidence.board.detail}</p>
        {confidence.board.decisionPending ? (
          <p className="mt-2 text-sm">
            <Link
              href={`/dashboard/${saveId}`}
              className={cn(linkClass, "font-medium")}
            >
              Respond to the board in the Front Office
            </Link>
          </p>
        ) : null}
      </Section>

      <Section title="Mood by Season">
        {view.seasonMoods.length === 0 ? (
          <EmptyState message="No completed seasons under this ownership yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">Mood</th>
                  <th className="px-3 py-2">Mandate</th>
                </tr>
              </thead>
              <tbody>
                {view.seasonMoods.map((row) => (
                  <tr
                    key={row.seasonYear}
                    className="border-b border-surface-raised text-ink"
                  >
                    <td className="px-3 py-2">{row.seasonYear}</td>
                    <td className="px-3 py-2">{row.moodLabel}</td>
                    <td className="px-3 py-2 text-muted">
                      {row.mandateSummary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Objective Record">
        {view.objectiveSeasons.length === 0 ? (
          <EmptyState message="No owner objectives have been resolved yet." />
        ) : (
          <div className="space-y-4">
            {view.objectiveSeasons.map((season) => (
              <div key={season.seasonYear}>
                <p className="mb-2 text-sm font-medium text-soft">
                  {season.seasonYear} · {season.completed} met · {season.failed}{" "}
                  missed
                </p>
                <ul className="space-y-2">
                  {season.objectives.map((objective) => (
                    <ObjectiveCard
                      key={objective.id}
                      type={objective.type}
                      description={objective.description}
                      seasonYear={objective.seasonYear}
                      status={objective.status}
                      role={objective.role}
                      lifecycle={objective.lifecycle}
                      target={objective.target}
                      progress={objective.progress}
                      consequenceApplied={objective.consequenceApplied}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
