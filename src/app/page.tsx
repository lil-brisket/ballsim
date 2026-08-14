import {
  createSaveAction,
  openSaveAction,
} from "@/application/actions";
import { listOwnerSaves } from "@/application/game-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const saves = await listOwnerSaves();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-500">
          Owner Mode Foundation
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50">
          Basketball
        </h1>
        <p className="max-w-xl text-zinc-400">
          Create or continue a fictional franchise save. New saves bootstrap
          rosters and a schedule; advance the world day from the dashboard.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-6">
        <h2 className="text-lg font-medium text-zinc-100">New save</h2>
        <form action={createSaveAction} className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="name">
            Save name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            defaultValue="Harbor Franchise"
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-500/40 focus:ring-2"
          />
          <button
            type="submit"
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
          >
            Create save
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-zinc-100">Existing saves</h2>
        {saves.length === 0 ? (
          <p className="text-sm text-zinc-500">No saves yet.</p>
        ) : (
          <ul className="space-y-2">
            {saves.map((save) => (
              <li
                key={save.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-100">{save.name}</p>
                  <p className="font-mono text-xs text-zinc-500">
                    schema v{save.schemaVersion} · {save.id}
                  </p>
                </div>
                <form action={openSaveAction}>
                  <input type="hidden" name="saveId" value={save.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:border-amber-600 hover:text-amber-400"
                  >
                    Open
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-zinc-600">
        See GAME_DESIGN.md and ARCHITECTURE.md in the repository root.
      </p>
    </main>
  );
}
