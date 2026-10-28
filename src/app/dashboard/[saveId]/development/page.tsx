import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadDevelopmentHubView } from "@/application/game-service";
import { ProgressionPanel } from "@/components/development/ProgressionPanel";
import { SkillRatingsTable } from "@/components/development/SkillRatingsTable";
import { TrainingCamps } from "@/components/development/TrainingCamps";
import { ManagementDecisionPanel } from "@/components/management/ManagementDecisionPanel";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { ViewSwitch } from "@/components/ui/ViewSwitch";
import { StaffEntityLink } from "@/components/entity/StaffEntityLink";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";

export const metadata: Metadata = { title: "Development" };

type PageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string; tab?: string }>;
};

export default async function DevelopmentHubPage({
  params,
  searchParams,
}: PageProps) {
  const { saveId } = await params;
  const { error, tab } = await searchParams;
  const activeTab =
    tab === "ratings"
      ? "ratings"
      : tab === "progression"
        ? "progression"
        : "camps";
  const view = await loadDevelopmentHubView(saveId);
  if (!view) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Player Development"
        actions={
          <Link
            href={`/dashboard/${saveId}/development-league`}
            className={cn(linkClass, touchTargetTextClass, focusRingClass)}
          >
            Franchise Development League
          </Link>
        }
      />
      {error ? <ErrorState message={error} /> : null}

      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line pb-3">
        <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <div>
            <dt className="text-sm text-muted">Developing</dt>
            <dd className="font-medium text-ink">
              {view.stageCounts.developing}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Prime</dt>
            <dd className="font-medium text-ink">{view.stageCounts.prime}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Declining</dt>
            <dd className="font-medium text-ink">
              {view.stageCounts.declining}
            </dd>
          </div>
        </dl>
        <div className="max-w-xs text-right text-sm text-faint">
          <p className="text-muted">Development staff</p>
          {view.staffContext.trainerName && view.staffContext.trainerId ? (
            <p className="mt-0.5 text-soft">
              <StaffEntityLink
                saveId={saveId}
                staffId={view.staffContext.trainerId}
              >
                {view.staffContext.trainerName}
              </StaffEntityLink>
              {view.staffContext.trainerOverall !== null
                ? ` · OVR ${view.staffContext.trainerOverall}`
                : ""}
            </p>
          ) : (
            <p className="mt-0.5 text-disabled">No trainer on staff</p>
          )}
          <p className="mt-1 text-sm text-disabled">
            Organizational context only — not a causal development claim.
          </p>
        </div>
      </div>

      <ViewSwitch
        aria-label="Development"
        activeKey={activeTab}
        items={[
          {
            key: "camps",
            label: "Training camps",
            href: `/dashboard/${saveId}/development`,
          },
          {
            key: "ratings",
            label: "Ratings",
            href: `/dashboard/${saveId}/development?tab=ratings`,
          },
          {
            key: "progression",
            label: "Progression",
            href: `/dashboard/${saveId}/development?tab=progression`,
          },
        ]}
      />

      {activeTab === "ratings" ? (
        <SkillRatingsTable saveId={saveId} rows={view.ratings} />
      ) : activeTab === "progression" ? (
        <ProgressionPanel saveId={saveId} view={view.progression} />
      ) : (
        <>
          <ManagementDecisionPanel
            title="Development Decisions"
            items={view.decisions}
            saveId={saveId}
            currentDate={view.currentDate}
            emptyMessage="No development-related decisions right now."
          />

          <Section title="Players to watch">
            {view.notableImprovers.length === 0 ? (
              <EmptyState message="No season-over-season improvement data available yet." />
            ) : (
              <ul className="space-y-1.5 text-sm">
                {view.notableImprovers.map((p) => (
                  <li
                    key={p.playerId}
                    className="flex flex-wrap items-center justify-between gap-2 text-soft"
                  >
                    <PlayerEntityLink saveId={saveId} playerId={p.playerId}>
                      {p.playerName}
                    </PlayerEntityLink>
                    <span className="tabular-nums text-emerald-300">
                      {p.changeDelta !== null && p.changeDelta > 0
                        ? `+${p.changeDelta}`
                        : p.changeDelta}
                      {p.changeLabel ? (
                        <span className="ml-2 text-sm text-disabled">
                          {p.changeLabel}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <TrainingCamps
            saveId={saveId}
            returnPath={`/dashboard/${saveId}/development`}
            plans={view.plans}
          />
        </>
      )}
    </div>
  );
}
