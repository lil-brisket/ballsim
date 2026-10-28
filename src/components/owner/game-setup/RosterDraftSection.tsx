import type { GameSettings } from "@/domain/game-settings";
import { CustomRosterPackageField } from "@/components/owner/CustomRosterPackageField";
import { SetupSection } from "@/components/owner/game-setup/fields";
import { RadioCardGroup } from "@/components/owner/game-setup/RadioCardGroup";
import {
  OPENING_OPTIONS,
  ROSTER_SOURCE_OPTIONS,
  SECTION_IDS,
  type OpeningId,
  type RosterSourceId,
} from "@/components/owner/game-setup/game-setup-helpers";

type RosterDraftSectionProps = {
  settings: GameSettings;
  useCustomRoster: boolean;
  fantasyOpening: boolean;
  rosterDropped: boolean;
  rosterPackageJson: string;
  onRosterSourceChange: (source: RosterSourceId) => void;
  onOpeningChange: (opening: OpeningId) => void;
  onPackageJsonChange: (value: string) => void;
};

export function RosterDraftSection({
  settings,
  useCustomRoster,
  fantasyOpening,
  rosterDropped,
  rosterPackageJson,
  onRosterSourceChange,
  onOpeningChange,
  onPackageJsonChange,
}: RosterDraftSectionProps) {
  return (
    <SetupSection id={SECTION_IDS.roster} title="Roster and Draft">
      <RadioCardGroup
        legend="Roster source"
        options={ROSTER_SOURCE_OPTIONS}
        value={useCustomRoster ? "custom" : "generated"}
        onChange={onRosterSourceChange}
      />
      <RadioCardGroup
        legend="Opening"
        options={OPENING_OPTIONS}
        value={fantasyOpening ? "fantasy" : "assigned"}
        onChange={onOpeningChange}
      />
      {useCustomRoster ? (
        <div className="space-y-3">
          {rosterDropped && rosterPackageJson.length === 0 ? (
            <p
              role="status"
              className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink"
            >
              Your roster package was too large to keep — upload it again.
            </p>
          ) : null}
          <CustomRosterPackageField
            teamCount={settings.league.teamCount}
            salaryCap={settings.financialRules.salaryCap}
            salaryCapEnabled={settings.financialRules.salaryCapEnabled}
            packageJson={rosterPackageJson}
            onPackageJsonChange={onPackageJsonChange}
          />
        </div>
      ) : null}
      {fantasyOpening && useCustomRoster ? (
        <p className="text-sm text-muted">
          Imported players enter the pool; generated players fill out 15-man
          drafts. Anyone not drafted becomes a free agent.
        </p>
      ) : null}
    </SetupSection>
  );
}
