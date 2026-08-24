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
import Link from "next/link";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

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
  const assessment = view.relocationAssessment;
  const returnPath = `/dashboard/${saveId}/relocation`;
  const canAdvance =
    assessment.status === "in_progress" || assessment.canStart;
  const topDestinations = assessment.destinationOpportunity.slice(0, 5);

  return (
    <>
      <PageHeader
        title="Relocation"
        subtitle="Late-game franchise decision — stay and invest, or move at a cost"
      />
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Status" value={assessment.status.replaceAll("_", " ")} />
        <StatCard
          label="Basketball"
          value={assessment.basketballHealth}
        />
        <StatCard label="Business" value={assessment.businessHealth} />
        <StatCard
          label="Market size"
          value={`${assessment.marketConstraint.marketSize}`}
        />
      </section>

      <Section title="Why this is on the table">
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
          {assessment.primaryDrivers.length === 0 ? (
            <li>No active market pressure — relocation is not a priority.</li>
          ) : (
            assessment.primaryDrivers.map((driver) => (
              <li key={driver}>{driver}</li>
            ))
          )}
        </ul>
        {assessment.constraints.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-200/90">
            {assessment.constraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title="Stay strategy">
        <p className="mb-2 text-sm text-zinc-400">
          Relocation is an opportunity cost. Existing owner actions remain available:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
          {assessment.stayAdvantages.map((advantage) => (
            <li key={advantage}>{advantage}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link
            href={`/dashboard/${saveId}/business`}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-amber-600"
          >
            Marketing & tickets
          </Link>
          <Link
            href={`/dashboard/${saveId}/facilities`}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-amber-600"
          >
            Facilities
          </Link>
          <Link
            href={`/dashboard/${saveId}/roster`}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:border-amber-600"
          >
            Roster
          </Link>
        </div>
      </Section>

      <Section title="Destination opportunity">
        {topDestinations.length === 0 ? (
          <p className="text-sm text-zinc-400">No open catalog markets.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm text-zinc-300">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">Market</th>
                  <th className="py-1 pr-3 font-medium">Size</th>
                  <th className="py-1 pr-3 font-medium">Opportunity</th>
                  <th className="py-1 pr-3 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {topDestinations.map((destination) => (
                  <tr key={destination.city} className="border-t border-zinc-800">
                    <td className="py-1.5 pr-3">
                      {destination.city} {destination.name}
                    </td>
                    <td className="py-1.5 pr-3">{destination.marketSize}</td>
                    <td className="py-1.5 pr-3">
                      {destination.opportunity.replaceAll("_", " ")}
                    </td>
                    <td className="py-1.5 pr-3">{destination.risk}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          {assessment.estimatedCost.transitionRiskSummary} Estimated fee about{" "}
          <MoneyDisplay amount={assessment.estimatedCost.fee} />.{" "}
          {assessment.estimatedCost.fanDisruptionSummary}
        </p>
      </Section>

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

      <Section title="Pursue relocation">
        {!canAdvance ? (
          <p className="text-sm text-zinc-400">
            Relocation is not available to start. Improve the stay path, wait for
            tenure, or wait until market pressure makes a move strategically
            relevant.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assessment.status !== "in_progress" ||
            relocation.stage === "evaluate" ||
            relocation.stage === "explore" ||
            relocation.stage === "none"
              ? topDestinations.slice(0, 3).map((destination) => (
                  <form key={destination.city} action={advanceRelocationAction}>
                    <input type="hidden" name="saveId" value={saveId} />
                    <input type="hidden" name="returnPath" value={returnPath} />
                    <input
                      type="hidden"
                      name="targetJson"
                      value={JSON.stringify({
                        city: destination.city,
                        name: destination.name,
                        abbreviation: destination.abbreviation,
                        marketSize: destination.marketSize,
                      })}
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-500"
                    >
                      {relocation.stage === "none"
                        ? `Start → ${destination.city}`
                        : `Set target ${destination.city}`}
                    </button>
                  </form>
                ))
              : null}
            <form action={advanceRelocationAction}>
              <input type="hidden" name="saveId" value={saveId} />
              <input type="hidden" name="returnPath" value={returnPath} />
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
        )}
      </Section>
    </>
  );
}
