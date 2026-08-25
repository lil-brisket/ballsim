import { notFound } from "next/navigation";
import { loadOwnerSaveView } from "@/application/game-service";
import { ErrorState } from "@/components/owner/EmptyState";
import { PageHeader } from "@/components/owner/PageHeader";
import { Section } from "@/components/owner/Section";

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
    simulation,
    ai,
    financialRules,
    offseason,
  } = settings;

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
          <SettingRow
            label="Play-in"
            value={playoffs.playInEnabled ? "On" : "Off"}
          />
        </dl>
      </Section>

      <Section title="Simulation">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <SettingRow label="Frequency" value={simulation.frequency} />
          <SettingRow label="AI difficulty" value={ai.difficulty} />
          <SettingRow
            label="Team management assistance"
            value={ai.managementMode.replaceAll("_", " ")}
          />
          <SettingRow
            label="Free agency duration"
            value={`${offseason.freeAgency.durationDays} days`}
          />
          <SettingRow
            label="FA extension allowed"
            value={offseason.freeAgency.allowExtension ? "Yes" : "No"}
          />
        </dl>
      </Section>

      <Section title="AI assistance domains">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {(
            Object.entries(ai.assistance) as [
              string,
              string,
            ][]
          ).map(([domain, mode]) => (
            <SettingRow
              key={domain}
              label={domain.replace(/([A-Z])/g, " $1")}
              value={mode}
            />
          ))}
        </dl>
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

function SettingRow(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 px-4 py-3">
      <dt className="text-xs uppercase tracking-wide text-zinc-600">
        {props.label}
      </dt>
      <dd className="mt-1 text-zinc-100">{props.value}</dd>
    </div>
  );
}
