import Link from "next/link";
import { notFound } from "next/navigation";
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

      <header className="space-y-2 border-b border-zinc-800 pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          {dashboard.controlledTeam.city} {dashboard.controlledTeam.name}
        </h1>
        <p className="text-zinc-400">
          {save.name} · {dashboard.leagueName}
        </p>
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
          <h2 className="text-sm font-medium text-zinc-400">Controlled team</h2>
          <p className="mt-2 text-2xl text-zinc-50">
            {dashboard.controlledTeam.abbreviation}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-sm font-medium text-zinc-400">Universe size</h2>
          <p className="mt-2 text-2xl text-zinc-50">
            {dashboard.teamCount} teams
            <span className="block text-sm font-normal text-zinc-500">
              {dashboard.playerCount} players (empty until roster generation)
            </span>
          </p>
        </div>
      </section>

      <p className="text-sm text-zinc-500">
        Dashboard reads persisted GameState only. No simulation advance controls
        are available in this foundation slice.
      </p>
    </main>
  );
}
