import Link from "next/link";
import { notFound } from "next/navigation";
import { advanceDayAction } from "@/application/actions";
import { loadOwnerSave } from "@/application/game-service";

type DashboardPageProps = {
  params: Promise<{ saveId: string }>;
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { saveId } = await params;
  const loaded = await loadOwnerSave(saveId);
  if (!loaded) {
    notFound();
  }

  const { save, dashboard } = loaded;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-amber-400"
        >
          ← Saves
        </Link>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-500">
          Owner Mode
        </p>
      </div>

      <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {dashboard.controlledTeam.city} {dashboard.controlledTeam.name}
          </h1>
          <p className="text-zinc-400">
            {save.name} · {dashboard.leagueName}
          </p>
        </div>
        <form action={advanceDayAction}>
          <input type="hidden" name="saveId" value={save.id} />
          <button
            type="submit"
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
          >
            Advance day
          </button>
        </form>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-sm font-medium text-zinc-400">World date</h2>
          <p className="mt-2 font-mono text-2xl text-zinc-50">
            {dashboard.currentDate}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-sm font-medium text-zinc-400">Season</h2>
          <p className="mt-2 text-2xl text-zinc-50">
            {dashboard.seasonYear}{" "}
            <span className="text-base text-zinc-400">
              ({dashboard.seasonPhase})
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-sm font-medium text-zinc-400">Record</h2>
          <p className="mt-2 text-2xl text-zinc-50">
            {dashboard.controlledStanding.wins}-
            {dashboard.controlledStanding.losses}
            <span className="ml-2 text-base text-zinc-400">
              {dashboard.controlledTeam.abbreviation}
            </span>
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-sm font-medium text-zinc-400">Universe size</h2>
          <p className="mt-2 text-2xl text-zinc-50">
            {dashboard.teamCount} teams
            <span className="block text-sm font-normal text-zinc-500">
              {dashboard.playerCount} players
            </span>
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-zinc-100">Recent results</h2>
        {dashboard.recentResults.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No final games yet. Advance the day when games are scheduled.
          </p>
        ) : (
          <ul className="space-y-2">
            {dashboard.recentResults.map((result) => (
              <li
                key={`${result.date}-${result.opponentAbbreviation}-${result.home}`}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm"
              >
                <span className="font-mono text-zinc-500">{result.date}</span>
                <span className="text-zinc-200">
                  {result.home ? "vs" : "@"} {result.opponentAbbreviation}{" "}
                  <span
                    className={
                      result.won ? "text-emerald-400" : "text-rose-400"
                    }
                  >
                    {result.teamScore}-{result.opponentScore}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
