import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-50">Save not found</h1>
      <p className="text-sm text-zinc-400">
        This save does not exist or could not be loaded. Return home and pick a
        valid save.
      </p>
      <Link
        href="/"
        className="text-sm text-amber-400 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
      >
        ← Home
      </Link>
    </main>
  );
}
