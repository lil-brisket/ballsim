import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";
import { DelegationSummary } from "@/components/owner/ai-management/DelegationSummary";
import {
  countDelegatedVisiblePhases,
  visibleDelegationPhaseCount,
} from "@/domain/ai-management-delegation";
import { INJURY_FREQUENCY_LABELS } from "@/domain/game-settings";

type SettingsPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/**
 * Read-only view of persisted GameState.settings.
 * Does not introduce a second settings store.
 */
export default async function InGameSettingsPage({
  params,
  searchParams,
}: SettingsPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadOwnerSaveView(saveId);
  if (!view) {
    notFound();
  }

  const { settings, dashboard } = view;
  const {
    league,
    regularSeason,
    playoffs,
    financialRules,
    injuryFrequency,
  } = settings;
  const activeFranchiseAi = dashboard.activeFranchiseAi;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Career configuration for this save (read-only)"
      />
      {error ? <ErrorState message={error} /> : null}

      <Section title="League">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <SettingRow label="League name" value={dashboard.leagueName} />
          <SettingRow label="Mode" value={dashboard.mode} />
          <SettingRow
            label="Team count (at create)"
            value={`${league.teamCount}`}
          />
          <SettingRow
            label="Live team count"
            value={`${dashboard.teamCount}`}
          />
          <SettingRow
            label="Conferences"
            value={`${league.conferenceCount}`}
          />
          <SettingRow
            label="Divisions"
            value={league.divisionsEnabled ? "On" : "Off"}
          />
          <SettingRow
            label="Games per team"
            value={`${regularSeason.gamesPerTeam}`}
          />
          <SettingRow
            label="Playoff teams"
            value={`${playoffs.playoffTeams}`}
          />
          <SettingRow
            label="Series length"
            value={`${playoffs.seriesLength}`}
          />
        </dl>
      </Section>

      <Section title="League rules">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <SettingRow
            label="Injury frequency"
            value={INJURY_FREQUENCY_LABELS[injuryFrequency]}
            description="Affects how frequently players become injured during simulation."
          />
        </dl>
      </Section>

      <Section title="AI Team Management">
        <p className="mb-3 text-sm text-zinc-400">
          Active franchise: {dashboard.controlledTeam.city}{" "}
          {dashboard.controlledTeam.name}.{" "}
          {countDelegatedVisiblePhases(activeFranchiseAi.assistance)} of{" "}
          {visibleDelegationPhaseCount()} phases delegated to AI
        </p>
        <DelegationSummary assistance={activeFranchiseAi.assistance} readOnly />
      </Section>

      <Section title="Financial rules">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <SettingRow
            label="Salary cap"
            value={financialRules.salaryCapEnabled ? "On" : "Off"}
          />
          <SettingRow
            label="Luxury tax"
            value={financialRules.luxuryTaxEnabled ? "On" : "Off"}
          />
          <SettingRow
            label="Revenue sharing"
            value={financialRules.revenueSharingEnabled ? "On" : "Off"}
          />
        </dl>
      </Section>
    </>
  );
}

function SettingRow(props: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-zinc-600">
        {props.label}
      </dt>
      <dd className="mt-1 text-zinc-100">{props.value}</dd>
      {props.description ? (
        <p className="mt-1 text-xs text-zinc-500">{props.description}</p>
      ) : null}
    </div>
  );
}
