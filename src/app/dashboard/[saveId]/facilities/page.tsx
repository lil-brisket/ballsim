import { notFound } from "next/navigation";
import { upgradeFacilityAction } from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function FacilitiesPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }
  const returnPath = `/dashboard/${saveId}/facilities`;

  return (
    <>
      <PageHeader
        title="Facilities"
        subtitle="Arena sets capacity; practice/training/medical improve next offseason development odds — not instant ratings"
      />
      {error ? <ErrorState message={error} /> : null}

      <Section title="How facilities help">
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-zinc-400">
          <li>Arena level raises maximum attendance (capacity).</li>
          <li>
            Practice, training, and medical improve the distribution of player
            development in the offseason — they do not guarantee overall gains.
          </li>
          <li>
            Youth facilities slightly help developing players. Fan facilities do
            not yet change sentiment in this build.
          </li>
          <li>Upgrades cost cash up front and raise weekly operating expense.</li>
        </ul>
      </Section>

      <Section title="Facility levels">
        {view.facilities.length === 0 ? (
          <EmptyState message="No facility data." />
        ) : (
          <ul className="space-y-2">
            {view.facilities.map((row) => (
              <li
                key={row.category}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-3"
              >
                <div>
                  <p className="font-medium capitalize text-zinc-100">
                    {row.category}
                  </p>
                  <p className="text-sm text-zinc-400">
                    Level {row.level}
                    {row.upgradeWeeksRemaining > 0
                      ? ` · upgrading (${row.upgradeWeeksRemaining} weeks left)`
                      : null}
                  </p>
                </div>
                {row.upgradeCost != null ? (
                  <form action={upgradeFacilityAction}>
                    <input type="hidden" name="saveId" value={saveId} />
                    <input type="hidden" name="category" value={row.category} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <button
                      type="submit"
                      className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-500"
                    >
                      Upgrade (<MoneyDisplay amount={row.upgradeCost} />)
                    </button>
                  </form>
                ) : (
                  <span className="text-sm text-zinc-500">Max / in progress</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
