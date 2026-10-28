import {
  maxControlledTeamCountForLeague,
  type GameSettings,
} from "@/domain/game-settings";
import {
  SelectField,
  SetupSection,
  inputClass,
} from "@/components/owner/game-setup/fields";
import {
  SECTION_IDS,
  teamsLabel,
} from "@/components/owner/game-setup/game-setup-helpers";
import { ControlButton } from "@/components/owner/game-setup/setup-shared";

type SaveDetailsSectionProps = {
  name: string;
  atSaveLimit: boolean;
  settings: GameSettings;
  localShared: boolean;
  participantsTotal: number;
  onNameChange: (name: string) => void;
  onSettingsChange: (settings: GameSettings) => void;
};

export function SaveDetailsSection({
  name,
  atSaveLimit,
  settings,
  localShared,
  participantsTotal,
  onNameChange,
  onSettingsChange: updateSettings,
}: SaveDetailsSectionProps) {
  return (
    <SetupSection id={SECTION_IDS.save} title="Save Details">
      <div className="space-y-1">
        <label className="block text-sm text-soft" htmlFor="save-name">
          Save name
        </label>
        <input
          id="save-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          disabled={atSaveLimit}
          className={inputClass}
        />
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium text-ink">Franchise control</p>
        {localShared ? (
          <p className="text-sm text-muted">
            Set by League Participants ({teamsLabel(participantsTotal)})
          </p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Decide how many franchises you will control. You choose the
              specific teams after the league is generated.
            </p>
            <div className="flex flex-wrap gap-2">
              <ControlButton
                selected={settings.ownership.controlledTeamCount === 1}
                onClick={() =>
                  updateSettings({
                    ...settings,
                    ownership: { controlledTeamCount: 1 },
                  })
                }
              >
                Control 1 team
              </ControlButton>
              <ControlButton
                selected={settings.ownership.controlledTeamCount > 1}
                onClick={() => {
                  const max = maxControlledTeamCountForLeague(
                    settings.league.teamCount,
                  );
                  const next = Math.min(
                    Math.max(2, settings.ownership.controlledTeamCount),
                    max,
                  );
                  updateSettings({
                    ...settings,
                    ownership: { controlledTeamCount: Math.max(2, next) },
                  });
                }}
              >
                Control multiple teams
              </ControlButton>
            </div>
            {settings.ownership.controlledTeamCount > 1 ? (
              <div className="max-w-xs">
                <SelectField
                  label="Number of controlled teams"
                  value={settings.ownership.controlledTeamCount}
                  options={Array.from(
                    {
                      length: Math.max(
                        0,
                        maxControlledTeamCountForLeague(
                          settings.league.teamCount,
                        ) - 1,
                      ),
                    },
                    (_, index) => {
                      const value = index + 2;
                      return { value, label: String(value) };
                    },
                  )}
                  onChange={(value) =>
                    updateSettings({
                      ...settings,
                      ownership: { controlledTeamCount: value },
                    })
                  }
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </SetupSection>
  );
}
