import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSaveWithHistory } from "@/application/game-service";
import {
  FranchiseLedgerTable,
  toFranchiseIdentityChanges,
} from "@/components/franchise/FranchiseLedgerTable";
import { FranchiseViews } from "@/components/franchise/FranchiseViews";
import { FranchiseHistorySummary } from "@/components/owner/FranchiseHistorySummary";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { cn, focusRingClass, linkClass } from "@/components/ui/styles";
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
      <FranchiseViews saveId={saveId} active="history" />
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
          <Section title="Relocations & Rebrands">
            {identityChanges.length === 0 ? (
              <p className="text-sm text-muted">
                The franchise has always played as {team.city} {team.name}.
              </p>
            ) : (
              <ul className="space-y-3">
                {identityChanges.map((change) => (
                  <li
                    key={change.seasonYear}
                    className="rounded-lg border border-line px-4 py-3"
                  >
                    <p className="text-sm text-faint">
                      {change.seasonYear} ·{" "}
                      {change.kind === "relocation" ? "Relocation" : "Rebrand"}
                    </p>
                    <p className="mt-1 font-medium text-ink">
                      {change.from} → {change.to}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      Value <MoneyDisplay amount={change.valueBefore} /> →{" "}
                      <MoneyDisplay amount={change.valueAfter} /> · Fan
                      sentiment {change.sentimentBefore} →{" "}
                      {change.sentimentAfter}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-sm text-faint">
              Before/after figures are season-end values either side of the
              change.
            </p>
          </Section>
        </>
      )}

      <p className="text-sm text-faint">
        Season results, team records, player history and retired jerseys live on{" "}
        <Link
          href={`/dashboard/${saveId}/team/history`}
          className={cn(linkClass, "font-medium", focusRingClass)}
        >
          Team History
        </Link>
        .
      </p>
    </div>
  );
}
