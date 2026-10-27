import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { signSponsorshipAction } from "@/application/actions";
import { loadOwnerSaveView } from "@/application/game-service";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn, focusRingClass } from "@/components/ui/styles";
import { buttonClass } from "@/components/ui/Button";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = { title: "Sponsorships" };

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
                className="rounded-lg border border-line px-4 py-3"
              >
                <p className="font-medium text-ink">{deal.sponsorName}</p>
                <p className="text-sm text-muted">
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
            aria-label="Sponsor name"
            placeholder="Sponsor name"
            defaultValue="City Trust Bank"
            className={cn(
              "min-h-11 rounded-md border border-line-strong bg-surface-raised px-3 text-sm text-ink",
              focusRingClass,
            )}
          />
          <NumberStepper
            name="annualValue"
            aria-label="Annual value"

            defaultValue={2_500_000}
            min={100000}
            step={100000}
            inputClassName="w-28"
          />
          <NumberStepper
            name="years"
            aria-label="Years"

            defaultValue={3}
            min={1}
            max={6}
          />
          <button type="submit" className={buttonClass({ variant: "primary" })}>
            Sign
          </button>
        </form>
      </Section>
    </>
  );
}
