import type { GameSettings } from "@/domain/game-settings";
import { AiTeamManagementSection } from "@/components/owner/ai-management";
import {
  FieldGrid,
  InjuryFrequencyField,
  MoneyInputField,
  SelectField,
  SetupSection,
  ToggleField,
} from "@/components/owner/game-setup/fields";
import { SECTION_IDS } from "@/components/owner/game-setup/game-setup-helpers";
import {
  DEFAULT_SALARY_CAP,
  MAX_SALARY_CAP,
  MIN_SALARY_CAP,
} from "@/systems/salary-cap-config";
import {
  DEFAULT_STAFF_BUDGET,
  MAX_STAFF_BUDGET,
  MIN_STAFF_BUDGET,
} from "@/systems/staff-budget-config";

type AdvancedSectionProps = {
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
};

export function InjuriesSection({
  settings,
  summary,
  onSettingsChange: updateSettings,
}: AdvancedSectionProps & { summary: string }) {
  return (
    <SetupSection
      id={SECTION_IDS.advanced}
      title="Injuries"
      description={`Current: ${summary}`}
    >
      <FieldGrid>
        <InjuryFrequencyField
          value={settings.injuryFrequency}
          onChange={(injuryFrequency) =>
            updateSettings({ ...settings, injuryFrequency })
          }
        />
      </FieldGrid>
    </SetupSection>
  );
}

export function AiManagementSection({
  settings,
  summary,
  onSettingsChange: updateSettings,
}: AdvancedSectionProps & { summary: string }) {
  return (
    <SetupSection
      id={SECTION_IDS.ai}
      title="AI Team Management"
      description={`Current: ${summary}`}
    >
      <FieldGrid>
        <div className="sm:col-span-2">
          <AiTeamManagementSection
            assistance={settings.ai.assistance}
            onAssistanceChange={(assistance) =>
              updateSettings({
                ...settings,
                ai: {
                  ...settings.ai,
                  managementPreset: "custom",
                  assistance,
                },
              })
            }
          />
        </div>
      </FieldGrid>
    </SetupSection>
  );
}

export function HistorySection({
  settings,
  onSettingsChange: updateSettings,
}: AdvancedSectionProps) {
  return (
    <SetupSection
      id={SECTION_IDS.history}
      title="League History"
      description={`Current: ${settings.history.mode === "new" ? "Completely new league" : "Generated prior history"}`}
    >
      <FieldGrid>
        <SelectField
          label="Starting world"
          value={settings.history.mode === "new" ? 0 : 1}
          options={[
            { value: 0, label: "Completely new league" },
            { value: 1, label: "Generate prior history" },
          ]}
          onChange={(value) =>
            updateSettings({
              ...settings,
              history: { mode: value === 0 ? "new" : "generated" },
            })
          }
        />
      </FieldGrid>
    </SetupSection>
  );
}

export function FinancialRulesSection({
  settings,
  summary,
  onSettingsChange: updateSettings,
}: AdvancedSectionProps & { summary: string }) {
  return (
    <SetupSection
      id={SECTION_IDS.financial}
      title="Financial Rules"
      description={`Current: ${summary}`}
    >
      <FieldGrid>
        <ToggleField
          label="Player Salary Cap enabled"
          checked={settings.financialRules.salaryCapEnabled}
          onChange={(checked) =>
            updateSettings({
              ...settings,
              financialRules: {
                ...settings.financialRules,
                salaryCapEnabled: checked,
              },
            })
          }
        />
        <MoneyInputField
          label="Player Salary Cap"
          value={settings.financialRules.salaryCap}
          min={MIN_SALARY_CAP}
          max={MAX_SALARY_CAP}
          defaultValue={DEFAULT_SALARY_CAP}
          disabled={!settings.financialRules.salaryCapEnabled}
          onChange={(salaryCap) =>
            updateSettings({
              ...settings,
              financialRules: {
                ...settings.financialRules,
                salaryCap,
              },
            })
          }
        />
        <MoneyInputField
          label="Staff Budget"
          value={settings.financialRules.staffBudget}
          min={MIN_STAFF_BUDGET}
          max={MAX_STAFF_BUDGET}
          defaultValue={DEFAULT_STAFF_BUDGET}
          onChange={(staffBudget) =>
            updateSettings({
              ...settings,
              financialRules: {
                ...settings.financialRules,
                staffBudget,
              },
            })
          }
        />
        <ToggleField
          label="Luxury tax"
          checked={settings.financialRules.luxuryTaxEnabled}
          onChange={(checked) =>
            updateSettings({
              ...settings,
              financialRules: {
                ...settings.financialRules,
                luxuryTaxEnabled: checked,
              },
            })
          }
        />
        <ToggleField
          label="Salary floor"
          checked={settings.financialRules.salaryFloorEnabled}
          onChange={(checked) =>
            updateSettings({
              ...settings,
              financialRules: {
                ...settings.financialRules,
                salaryFloorEnabled: checked,
              },
            })
          }
        />
        <ToggleField
          label="Veteran rights"
          checked={settings.financialRules.veteranRightsEnabled}
          onChange={(checked) =>
            updateSettings({
              ...settings,
              financialRules: {
                ...settings.financialRules,
                veteranRightsEnabled: checked,
              },
            })
          }
        />
        <ToggleField
          label="Revenue sharing"
          checked={settings.financialRules.revenueSharingEnabled}
          onChange={(checked) =>
            updateSettings({
              ...settings,
              financialRules: {
                ...settings.financialRules,
                revenueSharingEnabled: checked,
              },
            })
          }
        />
        <ToggleField
          label="Draft lottery"
          checked={settings.draftLottery.enabled}
          onChange={(checked) =>
            updateSettings({
              ...settings,
              draftLottery: {
                ...settings.draftLottery,
                enabled: checked,
              },
            })
          }
        />
        <ToggleField
          label="Restricted free agency"
          checked={settings.offseason.restrictedFreeAgency}
          onChange={(checked) =>
            updateSettings({
              ...settings,
              offseason: {
                ...settings.offseason,
                restrictedFreeAgency: checked,
              },
            })
          }
        />
      </FieldGrid>
    </SetupSection>
  );
}
