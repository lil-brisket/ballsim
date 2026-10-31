import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSettingsView } from "@/application/game-service";
import { Section } from "@/components/ui/Section";
import { RatingDisplaySetting } from "@/components/settings/RatingDisplaySetting";
import { RenameLeagueForm } from "@/components/settings/RenameLeagueForm";
import { SeasonFormatForm } from "@/components/settings/SeasonFormatForm";
import { SettingRow } from "@/components/settings/SettingRow";
import {
  HostOnlyNotice,
  SettingsPageShell,
} from "@/components/settings/SettingsPageShell";
import { settingsTabPath } from "@/components/settings/settings-paths";
import { LEAGUE_AREA_LABELS } from "@/domain/game-settings";

export const metadata: Metadata = { title: "Settings" };

type SettingsPageProps = {
  params: Promise<{ saveId: string }>;
  searchParams: Promise<{ error?: string }>;
};

/** League tab: name, structure and season format (Issue #191). */
export default async function InGameSettingsPage({
  params,
  searchParams,
}: SettingsPageProps) {
  const { saveId } = await params;
  const { error } = await searchParams;
  const view = await loadSettingsView(saveId);
  if (!view) {
    notFound();
  }

  const { league, regularSeason, playoffs } = view.settings;
  const returnPath = settingsTabPath(saveId, "league");

  return (
    <SettingsPageShell saveId={saveId} active="league" error={error}>
      <Section title="Display">
        <RatingDisplaySetting />
      </Section>

      <Section title="League">
        {view.canEditLeague ? null : (
          <HostOnlyNotice>
            Only the league host can change league settings.
          </HostOnlyNotice>
        )}
        <RenameLeagueForm
          saveId={saveId}
          returnPath={returnPath}
          leagueName={view.leagueName}
          disabled={!view.canEditLeague}
        />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <SettingRow label="Mode" value={view.mode} />
          <SettingRow
            label="Team count (at create)"
            value={`${league.teamCount}`}
          />
          <SettingRow label="Live team count" value={`${view.liveTeamCount}`} />
          <SettingRow label="Conferences" value={`${league.conferenceCount}`} />
          <SettingRow
            label="Divisions"
            value={league.divisionsEnabled ? "On" : "Off"}
          />
          <SettingRow
            label="Area"
            value={league.area ? LEAGUE_AREA_LABELS[league.area] : "—"}
          />
        </dl>
        <p className="text-sm text-faint">
          League structure is set when the league is created and cannot be
          changed here.
        </p>
      </Section>

      <Section title="Season format">
        <SeasonFormatForm
          saveId={saveId}
          returnPath={returnPath}
          initial={{
            gamesPerTeam: regularSeason.gamesPerTeam,
            playoffTeams: playoffs.playoffTeams,
            seriesLength: playoffs.seriesLength,
          }}
          liveTeamCount={view.liveTeamCount}
          lockReason={view.seasonFormatLock}
          canEdit={view.canEditLeague}
        />
      </Section>
    </SettingsPageShell>
  );
}
