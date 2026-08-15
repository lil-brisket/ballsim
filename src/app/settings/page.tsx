import Link from "next/link";

export default function GlobalSettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <Link
          href="/home"
          className="text-sm text-zinc-400 hover:text-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          ← Home
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
          Settings
        </h1>
        <p className="text-zinc-400">
          League and simulation settings are stored with each save. Open a
          franchise and use in-game Settings to review them.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm text-zinc-300">
        <p>
          There is no separate global configuration store. Create or continue a
          save to access career settings for that franchise.
        </p>
      </section>
    </main>
  );
}
