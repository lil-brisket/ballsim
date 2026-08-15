import Link from "next/link";
import { notFound } from "next/navigation";
import { selectTeamAction } from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";

type TeamPickPageProps = {
  params: Promise<{ saveId: string }>;
};

export default async function TeamPickPage({ params }: TeamPickPageProps) {
  const { saveId } = await params;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  if (view.dashboard.teamSelectionLocked) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
        <p className="text-zinc-300">
          Team selection is locked for this save.
        </p>
        <Link
          href={`/dashboard/${saveId}`}
          className="text-amber-400 hover:underline"
        >
          Open dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-500">
          New Game
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          Pick your team
        </h1>
        <p className="text-zinc-400">
          Choose one franchise to control. You can change this until the first
          time advance.
        </p>
      </header>

      <ul className="space-y-2">
        {view.teams.map((team) => (
          <li
            key={team.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
          >
            <div>
              <p className="font-medium text-zinc-100">
                {team.city} {team.name}{" "}
                <span className="font-mono text-xs text-zinc-500">
                  ({team.abbreviation})
                </span>
              </p>
              <p className="text-xs text-zinc-500">
                {team.conferenceName} · {team.divisionName}
              </p>
            </div>
            <form action={selectTeamAction}>
              <input type="hidden" name="saveId" value={saveId} />
              <input type="hidden" name="teamId" value={team.id} />
              <button
                type="submit"
                className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
              >
                Select
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
