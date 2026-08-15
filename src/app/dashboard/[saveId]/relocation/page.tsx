import { notFound } from "next/navigation";
import {
  advanceRelocationAction,
  cancelRelocationAction,
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

const DEFAULT_TARGET = JSON.stringify({
  city: "Harbor",
  name: "Waves",
  abbreviation: "HAR",
  marketSize: 62,
});

export default async function RelocationPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }
  const relocation = view.relocation;
  const returnPath = `/dashboard/${saveId}/relocation`;

  return (
    <>
      <PageHeader
        title="Relocation"
        subtitle="Multi-stage process — cancellable before league approval"
      />
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Stage" value={relocation.stage} />
        <StatCard
          label="Fee"
          value={<MoneyDisplay amount={relocation.fee} />}
        />
        <StatCard
          label="Cooldown seasons"
          value={`${relocation.cooldownSeasonsRemaining}`}
        />
        <StatCard
          label="Target"
          value={
            relocation.target
              ? `${relocation.target.city} ${relocation.target.name}`
              : "—"
          }
        />
      </section>

      <Section title="Actions">
        <div className="flex flex-wrap gap-2">
          <form action={advanceRelocationAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <input type="hidden" name="targetJson" value={DEFAULT_TARGET} />
            <button
              type="submit"
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
            >
              Advance stage
            </button>
          </form>
          <form action={cancelRelocationAction}>
            <input type="hidden" name="saveId" value={saveId} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <button
              type="submit"
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-red-500"
            >
              Cancel
            </button>
          </form>
        </div>
      </Section>
    </>
  );
}
