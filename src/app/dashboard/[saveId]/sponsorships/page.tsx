import { notFound } from "next/navigation";
import { signSponsorshipAction } from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function SponsorshipsPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }
  const returnPath = `/dashboard/${saveId}/sponsorships`;

  return (
    <>
      <PageHeader
        title="Sponsorships"
        subtitle="Commercial contracts (separate from player and staff contracts)"
      />
      {error ? <ErrorState message={error} /> : null}

      <Section title="Active and historical deals">
        {view.sponsorships.length === 0 ? (
          <EmptyState message="No sponsorships yet." />
        ) : (
          <ul className="space-y-2">
            {view.sponsorships.map((deal) => (
              <li
                key={deal.id}
                className="rounded-lg border border-zinc-800 px-4 py-3"
              >
                <p className="font-medium text-zinc-100">{deal.sponsorName}</p>
                <p className="text-sm text-zinc-400">
                  <MoneyDisplay amount={deal.annualValue} /> / yr ·{" "}
                  {deal.startYear}–{deal.endYear} · {deal.status}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Sign a sponsorship">
        <form action={signSponsorshipAction} className="flex flex-wrap gap-3">
          <input type="hidden" name="saveId" value={saveId} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <input
            name="sponsorName"
            placeholder="Sponsor name"
            defaultValue="City Trust Bank"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
          <input
            type="number"
            name="annualValue"
            defaultValue={2_500_000}
            min={100000}
            step={100000}
            className="w-36 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
          <input
            type="number"
            name="years"
            defaultValue={3}
            min={1}
            max={6}
            className="w-20 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          />
          <button
            type="submit"
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
          >
            Sign
          </button>
        </form>
      </Section>
    </>
  );
}
