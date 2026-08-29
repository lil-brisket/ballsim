import { notFound, redirect } from "next/navigation";
import { continueAfterFantasyDraftAction } from "@/application/actions";
import { loadFantasyDraftView } from "@/application/game-service";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";

type PageProps = {
  params: Promise<{ saveId: string }>;
};

export default async function FantasyDraftSummaryPage({ params }: PageProps) {
  const { saveId } = await params;
  const loaded = await loadFantasyDraftView(saveId);
  if (!loaded) {
    notFound();
  }
  if (loaded.draft.status !== "complete") {
    if (loaded.draft.status === "setup") {
      redirect(`/new/${saveId}/fantasy-draft/setup`);
    }
    redirect(`/fantasy-draft/${saveId}`);
  }

  const { draft } = loaded;
  const byTeam = new Map<
    string,
    { name: string; abbreviation: string; picks: typeof draft.selections }
  >();

  for (const entry of draft.draftOrder) {
    byTeam.set(entry.teamId, {
      name: entry.teamName,
      abbreviation: entry.abbreviation,
      picks: [],
    });
  }
  for (const sel of draft.selections) {
    const bucket = byTeam.get(sel.teamId);
    if (bucket) {
      bucket.picks.push(sel);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <PageHeader
        title="Fantasy Draft Complete"
        subtitle={`${draft.selectionsMade} picks · ${draft.undraftedCount} undrafted free agents`}
      />

      <Section title="Team results">
        <div className="space-y-6">
          {[...byTeam.entries()].map(([teamId, team], index) => {
            const avg =
              team.picks.length === 0
                ? 0
                : Math.round(
                    team.picks.reduce((sum, pick) => {
                      // overall not on selection; show count only
                      return sum;
                    }, 0) / Math.max(1, team.picks.length),
                  );
            void avg;
            return (
              <div
                key={teamId}
                className="rounded-lg border border-zinc-800 p-4"
              >
                <h3 className="font-medium">
                  #{index + 1} {team.name}{" "}
                  <span className="text-zinc-500">
                    ({team.picks.length} picks)
                  </span>
                </h3>
                <ul className="mt-2 grid gap-1 text-sm text-zinc-300 sm:grid-cols-2">
                  {team.picks.map((pick) => (
                    <li key={pick.pickNumber}>
                      R{pick.round}P{pick.pickInRound}: {pick.playerName} (
                      {pick.position})
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      <form action={continueAfterFantasyDraftAction}>
        <input type="hidden" name="saveId" value={saveId} />
        <button
          type="submit"
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
        >
          Continue League
        </button>
      </form>
    </main>
  );
}
