import {
  LEAGUE_AREA_LABELS,
  LEAGUE_AREA_OPTIONS,
  SUPPORTED_GAMES_PER_TEAM,
  SUPPORTED_PLAYOFF_TEAM_COUNTS,
  SUPPORTED_SERIES_LENGTHS,
  SUPPORTED_TEAM_COUNTS,
  type GameSettings,
  type SeriesLength,
} from "@/domain/game-settings";
import {
  settingsForPreset,
  type LeagueSetupPresetId,
} from "@/domain/game-settings-presets";
import {
  FieldGrid,
  SelectField,
  SetupSection,
  ToggleField,
} from "@/components/owner/game-setup/fields";
import {
  RadioCardGroup,
  type RadioCardOption,
} from "@/components/owner/game-setup/RadioCardGroup";
import {
  PRESET_COPY,
  SECTION_IDS,
  leagueAreaIndex,
  leagueNumbers,
} from "@/components/owner/game-setup/game-setup-helpers";

type LeagueFormatSectionProps = {
  preset: LeagueSetupPresetId;
  settings: GameSettings;
  rosterTeamCountLocked: boolean;
  onPresetChange: (preset: LeagueSetupPresetId) => void;
  onSettingsChange: (settings: GameSettings) => void;
};

export function LeagueFormatSection({
  preset,
  settings,
  rosterTeamCountLocked,
  onPresetChange,
  onSettingsChange: updateSettings,
}: LeagueFormatSectionProps) {
  const presetOptions: ReadonlyArray<RadioCardOption<LeagueSetupPresetId>> = (
    ["standard", "cbl", "custom"] as const
  ).map((id) => ({
    value: id,
    title: PRESET_COPY[id].title,
    description: PRESET_COPY[id].text,
    meta: leagueNumbers(id === "custom" ? settings : settingsForPreset(id)),
  }));

  return (
    <SetupSection
      id={SECTION_IDS.league}
      title="League Format"
      description="Pick a starting point, then change any rule. Editing a rule switches the preset to Custom."
    >
      <RadioCardGroup
        legend="Preset"
        columns={3}
        options={presetOptions}
        value={preset}
        onChange={onPresetChange}
      />
      <FieldGrid>
        <div className="space-y-1">
          <SelectField
            label="Number of teams"
            value={settings.league.teamCount}
            options={SUPPORTED_TEAM_COUNTS.map((value) => ({
              value,
              label: String(value),
            }))}
            disabled={rosterTeamCountLocked}
            onChange={(value) =>
              updateSettings({
                ...settings,
                league: { ...settings.league, teamCount: value },
              })
            }
          />
          {rosterTeamCountLocked ? (
            <p className="text-sm text-faint">
              Team count comes from the loaded custom roster package.
            </p>
          ) : null}
        </div>
        <SelectField
          label="Conferences"
          value={settings.league.conferenceCount}
          options={[
            { value: 1, label: "1 conference" },
            { value: 2, label: "2 conferences" },
          ]}
          onChange={(value) =>
            updateSettings({
              ...settings,
              league: { ...settings.league, conferenceCount: value },
            })
          }
        />
        <SelectField
          label="League area"
          value={leagueAreaIndex(settings.league.area ?? "north_america")}
          options={LEAGUE_AREA_OPTIONS.map((area, index) => ({
            value: index,
            label: LEAGUE_AREA_LABELS[area],
          }))}
          onChange={(value) =>
            updateSettings({
              ...settings,
              league: {
                ...settings.league,
                area: LEAGUE_AREA_OPTIONS[value] ?? "north_america",
              },
            })
          }
        />
        <ToggleField
          label="Divisions"
          checked={settings.league.divisionsEnabled}
          onChange={(checked) =>
            updateSettings({
              ...settings,
              league: { ...settings.league, divisionsEnabled: checked },
            })
          }
        />
        <SelectField
          label="Games per team"
          value={settings.regularSeason.gamesPerTeam}
          options={SUPPORTED_GAMES_PER_TEAM.map((value) => ({
            value,
            label: String(value),
          }))}
          onChange={(value) =>
            updateSettings({
              ...settings,
              regularSeason: {
                ...settings.regularSeason,
                gamesPerTeam: value,
              },
            })
          }
        />
        <SelectField
          label="Playoff teams"
          value={settings.playoffs.playoffTeams}
          options={SUPPORTED_PLAYOFF_TEAM_COUNTS.map((value) => ({
            value,
            label: String(value),
          }))}
          onChange={(value) =>
            updateSettings({
              ...settings,
              playoffs: { ...settings.playoffs, playoffTeams: value },
            })
          }
        />
        <SelectField
          label="Series length"
          value={settings.playoffs.seriesLength}
          options={SUPPORTED_SERIES_LENGTHS.map((value) => ({
            value,
            label: `Best of ${value}`,
          }))}
          onChange={(value) =>
            updateSettings({
              ...settings,
              playoffs: {
                ...settings.playoffs,
                seriesLength: value as SeriesLength,
              },
            })
          }
        />
      </FieldGrid>
    </SetupSection>
  );
}
