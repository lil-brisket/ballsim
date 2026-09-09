import Link from "next/link";
import { notFound } from "next/navigation";
import { loadFranchiseHubView } from "@/application/game-service";
import { ManagementDecisionPanel } from "@/components/management/ManagementDecisionPanel";
import { EmptyState, ErrorState } from "@/components/owner/EmptyState";
import { FranchiseHistorySummary } from "@/components/owner/FranchiseHistorySummary";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { ProgressBar } from "@/components/ui/ProgressBar";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Franchise Hub — long-term organizational state and objectives.
 * Intentionally high-level; deep work lives on subsystem pages.
 */
export default async function FranchiseOverviewPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadFranchiseHubView(saveId);
  if (!view) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Franchise"
        subtitle={`${view.teamName} · long-term ownership`}
      />
      {error ? <ErrorState message={error} /> : null}

      {/* 1. Franchise Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-zinc-800 pb-3">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
            Organization
          </p>
          <h2 className="text-lg font-medium text-zinc-50">{view.teamName}</h2>
          <p className="text-xs text-zinc-500">
            Owner tenure:{" "}
            {view.ownerTenureYears > 0
              ? `${view.ownerTenureYears} season${view.ownerTenureYears === 1 ? "" : "s"}`
              : "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[0.65rem] uppercase tracking-wide text-zinc-500">
            Franchise value
          </p>
          <p className="text-lg font-medium text-zinc-100">
            <MoneyDisplay amount={view.franchiseValue} />
          </p>
        </div>
      </div>

      {/* 2. Organizational Snapshot — 3–4 metrics max */}
      <Section title="Organizational Snapshot">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Snap
            label="Record"
            value={`${view.snapshot.wins}–${view.snapshot.losses}`}
          />
          <Snap
            label="Fan sentiment"
            value={String(view.snapshot.fanSentiment)}
          />
          <Snap
            label="Health"
            value={
              view.snapshot.franchiseHealthLabel ? (
                <span className="capitalize text-sm">
                  {view.snapshot.franchiseHealthLabel}
                </span>
              ) : (
                "—"
              )
            }
          />
          <Snap
            label="Value"
            value={<MoneyDisplay amount={view.snapshot.franchiseValue} />}
          />
        </dl>
      </Section>

      <ManagementDecisionPanel
        title="Franchise Decisions"
        items={view.decisions}
        saveId={saveId}
        currentDate={view.currentDate}
        emptyMessage="No franchise-level decisions need attention right now."
      />

      {/* 3. Objectives */}
      <Section title="Objectives">
        {view.objectives.length === 0 ? (
          <EmptyState message="No active ownership objectives." />
        ) : (
          <ul className="space-y-3">
            {view.objectives.map((obj) => {
              const hasProgress =
                obj.progress !== null && obj.target !== null && obj.target > 0;
              return (
                <li
                  key={obj.id}
                  className="rounded-lg border border-zinc-800 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-100">
                      {obj.description}
                    </p>
                    <StatusBadge label={obj.status} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {obj.role.replaceAll("_", " ")}
                    {obj.horizonYears != null
                      ? ` · ${obj.horizonYears}y horizon`
                      : ""}
                    {obj.seasonYear ? ` · ${obj.seasonYear}` : ""}
                  </p>
                  {hasProgress ? (
                    <div className="mt-2">
                      <ProgressBar
                        value={obj.progress!}
                        max={obj.target!}
                        label="Progress"
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* 4. Franchise History */}
      <Section title="Franchise History">
        {view.history.seasons.length === 0 ? (
          <EmptyState message="No franchise history recorded yet." />
        ) : (
          <FranchiseHistorySummary view={view.history} />
        )}
      </Section>

      {/* 5. Subsystem Links */}
      <Section title="Manage">
        <div className="grid gap-3 sm:grid-cols-2">
          {view.links.map((link) => (
            <Link
              key={link.href + link.title}
              href={link.href}
              className="block rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 transition-colors hover:border-amber-700/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-amber-500">
                {link.title}
              </p>
              <p className="mt-1 text-sm text-zinc-300">{link.description}</p>
              <p className="mt-3 text-sm font-medium text-amber-400">
                {link.cta}
              </p>
            </Link>
          ))}
        </div>
      </Section>

      <p className="text-sm text-zinc-500">
        Major franchise moves such as relocation are available from the
        Offseason Hub when eligible — not as permanent destinations.
      </p>
    </div>
  );
}

function Snap(props: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.65rem] uppercase tracking-wide text-zinc-500">
        {props.label}
      </dt>
      <dd className="mt-0.5 font-medium text-zinc-100">{props.value}</dd>
    </div>
  );
}
