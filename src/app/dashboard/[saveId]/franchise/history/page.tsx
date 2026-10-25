import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSaveWithHistory } from "@/application/game-service";
import {
  FranchiseLedgerTable,
  toFranchiseIdentityChanges,
} from "@/components/franchise/FranchiseLedgerTable";
import { FranchiseSubNav } from "@/components/franchise/FranchiseSubNav";
import { FranchiseHistorySummary } from "@/components/owner/FranchiseHistorySummary";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { cn, linkClass } from "@/components/ui/styles";
import { getActiveTeam } from "@/state/owner-context";
import { toFranchiseHistoryView } from "@/state/franchise-selectors";

export const metadata: Metadata = { title: "Franchise History" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Franchise History tab — ownership milestones, the business ledger and
 * identity changes. Season results, team records, player history and
 * retired jerseys stay on Team History.
 */
export default async function FranchiseHistoryPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  // Old seasons live in the stored history.
  const loaded = await loadSaveWithHistory(saveId);
  if (!loaded) {
    notFound();
  }
  const team = getActiveTeam(loaded.state);
  const history = toFranchiseHistoryView(loaded.state);
  const identityChanges = toFranchiseIdentityChanges(history.seasons);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Franchise"
        subtitle={`${team.city} ${team.name} · franchise history`}
      />
      <FranchiseSubNav saveId={saveId} active="history" />
      {error ? <ErrorState message={error} /> : null}

      {history.seasons.length === 0 ? (
        <EmptyState message="No franchise history recorded yet." />
      ) : (
        <>
          <Section title="Milestones">
            <FranchiseHistorySummary view={history} />
          </Section>
          <Section title="Business Ledger">
            <FranchiseLedgerTable seasons={history.seasons} />
          </Section>
          <Section title="Identity">
            {identityChanges.length === 0 ? (
              <p className="text-sm text-zinc-400">
                The franchise has always played as {team.city} {team.name}.
              </p>
            ) : (
              <ul className="space-y-2 text-sm text-zinc-300">
                {identityChanges.map((change) => (
                  <li key={change.seasonYear}>
                    <span className="text-zinc-500">{change.seasonYear}</span>{" "}
                    {change.from} → {change.to}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      <p className="text-sm text-zinc-500">
        Season results, team records, player history and retired jerseys live on{" "}
        <Link
          href={`/dashboard/${saveId}/team/history`}
          className={cn(linkClass, "font-medium")}
        >
          Team History
        </Link>
        .
      </p>
    </div>
  );
}
