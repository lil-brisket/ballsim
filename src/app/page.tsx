import Link from "next/link";

export default function SplashPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Link
        href="/home"
        className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-500"
      >
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-500">
          Basketball
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          Franchise Simulation
        </h1>
        <p className="max-w-md text-zinc-400">
          Own a team, manage the franchise, and guide your organization through
          seasons of fictional basketball.
        </p>
        <p className="text-sm font-medium text-amber-400">Click to continue</p>
      </Link>
    </main>
  );
}
