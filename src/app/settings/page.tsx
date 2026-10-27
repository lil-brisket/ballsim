import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";

export default function GlobalSettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <Link
          href="/home"
          className="text-sm text-muted hover:text-team-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink"
        >
          ← Home
        </Link>
        <SectionHeading as="h1" size="lg" title="Settings" />
        <p className="text-muted">
          League and simulation settings are stored with each save. Open a
          franchise and use in-game Settings to review them.
        </p>
      </header>

      <section className="rounded-xl border border-line bg-surface-raised/50 p-5 text-sm text-soft">
        <p>
          There is no separate global configuration store. Create or continue a
          save to access career settings for that franchise.
        </p>
      </section>
    </main>
  );
}
