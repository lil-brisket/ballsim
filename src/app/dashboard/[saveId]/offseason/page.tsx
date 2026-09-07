import Link from "next/link";
import { notFound } from "next/navigation";
import { prismaSaveGameStore } from "@/persistence/save-game-repository";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { toOwnerDashboardView } from "@/state/owner-dashboard";
import { toPhaseDashboardView } from "@/state/phase-dashboard";
import {
  isOffseasonPeriod,
  isRelocationAccessible,
} from "@/state/owner-season-context";
import { getCalendarContext } from "@/systems/simulation/calendar-context";

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Offseason Hub — decision launcher for the offseason window.
 * Calendar remains the primary time-control system.
 */
export default async function OffseasonHubPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const loaded = await prismaSaveGameStore.load(saveId);
  if (!loaded) {
    notFound();
  }
  const state = loaded.state;
  const base = `/dashboard/${saveId}`;

  if (!isOffseasonPeriod(state)) {
    return (
      <>
        <PageHeader
          title="Offseason Hub"
          subtitle="Available when the season enters the offseason"
        />
        {error ? <ErrorState message={error} /> : null}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-6">
          <p className="text-sm text-zinc-300">
            The offseason has not begun for this franchise. Use the Calendar to
            advance through the current season.
          </p>
          <Link
            href={`${base}/calendar`}
            className="mt-4 inline-block text-sm font-medium text-amber-400 hover:text-amber-300"
          >
            Open Calendar
          </Link>
        </div>
      </>
    );
  }

  const dash = toOwnerDashboardView(state);
  const phase = toPhaseDashboardView(state);
  const calendar = getCalendarContext(state);
  const relocationOk = isRelocationAccessible(state);
  const blocking = dash.actionItems.filter((i) => i.severity === "critical");
  const actionable = dash.actionItems.filter((i) => i.severity === "warning");
  const informational = dash.actionItems.filter((i) => i.severity === "info");

  return (
    <>
      <PageHeader
        title="Offseason Hub"
        subtitle={`Season ${dash.seasonYear} · ${calendar.offseasonStage.replaceAll("_", " ")}`}
      />
      {error ? <ErrorState message={error} /> : null}

      <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 px-4 py-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-amber-500">
          Season complete
        </p>
        <p className="mt-1 text-sm text-zinc-200">
          Your franchise has entered the offseason. Review available decisions
          below, then use the Calendar to advance through offseason events.
        </p>
        <Link
          href={`${base}/calendar`}
          className="mt-3 inline-block text-sm font-medium text-amber-400 hover:text-amber-300"
        >
          Open Calendar
        </Link>
      </div>

      {blocking.length === 0 &&
      actionable.length === 0 &&
      !relocationOk ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 text-sm text-zinc-300">
          No immediate decisions required. Use the Calendar to continue through
          the offseason.
        </div>
      ) : null}

      <Section title="Outstanding decisions">
        <DecisionList
          title="Blocking"
          items={blocking}
          empty="Nothing is blocking time advancement."
        />
        <DecisionList
          title="Available decisions"
          items={actionable}
          empty="No optional decisions need attention right now."
        />
        {informational.length > 0 ? (
          <DecisionList title="Informational" items={informational} />
        ) : null}
      </Section>

      <Section title="Season review">
        <div className="grid gap-3 sm:grid-cols-2">
          <HubCard
            title="Phase overview"
            description={phase.nowLabel}
            href={base}
            cta="Open Dashboard"
          />
          <HubCard
            title="Franchise history"
            description="Review prior seasons and milestones"
            href={`${base}/history`}
            cta="View History"
          />
        </div>
      </Section>

      <Section title="Basketball operations">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <HubCard
            title="Draft"
            description="Prospect board and picks"
            href={`${base}/draft`}
            cta="Open Draft"
          />
          <HubCard
            title="Free agency"
            description="Shape next season's roster"
            href={`${base}/free-agency`}
            cta="Open Free Agency"
          />
          <HubCard
            title="Contracts"
            description="Expiring deals and cap decisions"
            href={`${base}/contracts`}
            cta="Review Contracts"
          />
          <HubCard
            title="Roster"
            description="Players and injury availability"
            href={`${base}/roster`}
            cta="Open Roster"
          />
          <HubCard
            title="Development"
            description="Development league assignments"
            href={`${base}/development`}
            cta="Open Development"
          />
          <HubCard
            title="Staff & coaching"
            description="Front office and coaching staff"
            href={`${base}/staff-coaching`}
            cta="Open Staff"
          />
        </div>
      </Section>

      <Section title="Franchise decisions">
        <div className="grid gap-3 sm:grid-cols-2">
          <HubCard
            title="Facilities & arena"
            description="Capital upgrades for next season"
            href={`${base}/facilities`}
            cta="Manage Facilities"
          />
          <HubCard
            title="Brand & market"
            description="Marketing, tickets, and awareness"
            href={`${base}/business`}
            cta="Manage Branding"
          />
          <HubCard
            title="Finances"
            description="Cash, payroll, and season P&L"
            href={`${base}/finances`}
            cta="View Finances"
          />
          {relocationOk ? (
            <HubCard
              title="Relocation"
              description="Evaluate markets or continue an active relocation"
              href={`${base}/relocation`}
              cta="Open Relocation"
            />
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-4">
              <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-600">
                Relocation
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Relocation is not currently available for this franchise.
              </p>
            </div>
          )}
        </div>
      </Section>
    </>
  );
}

function DecisionList(props: {
  title: string;
  items: ReadonlyArray<{
    id: string;
    title: string;
    what: string;
    href: string;
    hrefLabel: string;
  }>;
  empty?: string;
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
        {props.title}
      </p>
      {props.items.length === 0 ? (
        props.empty ? (
          <p className="text-sm text-zinc-500">{props.empty}</p>
        ) : null
      ) : (
        <ul className="space-y-2">
          {props.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-3"
            >
              <div>
                <p className="font-medium text-zinc-100">{item.title}</p>
                <p className="text-sm text-zinc-400">{item.what}</p>
              </div>
              <Link
                href={item.href}
                className="text-sm text-amber-400 hover:text-amber-300"
              >
                {item.hrefLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HubCard(props: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={props.href}
      className="block rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 transition-colors hover:border-amber-700/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
    >
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-amber-500">
        {props.title}
      </p>
      <p className="mt-1 text-sm text-zinc-300">{props.description}</p>
      <p className="mt-3 text-sm font-medium text-amber-400">{props.cta}</p>
    </Link>
  );
}
