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
  const returnPath = `/dashboard/${saveId}/league`;

  return (
    <>
      <PageHeader
        title="League"
        subtitle="League economics and expansion foundation"
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

      <Section title={`Expansion (${expansion.stage})`}>
        <p className="mb-3 text-sm text-zinc-400">
          Fee: <MoneyDisplay amount={expansion.fee} />
          {expansion.newTeamId
            ? ` · New team: ${expansion.newTeamId}`
            : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <form action={proposeExpansionAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <button
              type="submit"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600"
            >
              Propose
            </button>
          </form>
          {expansion.candidates.map((candidate, index) => (
            <form key={`${candidate.city}-${index}`} action={approveExpansionAction}>
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
        </div>
      </Section>
    </>
  );
}
