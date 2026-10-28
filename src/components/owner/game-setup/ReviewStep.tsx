import {
  INJURY_FREQUENCY_LABELS,
  type GameSettings,
} from "@/domain/game-settings";
import type { LeagueSetupPresetId } from "@/domain/game-settings-presets";
import type { ParticipationMode } from "@/domain/participation";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/owner/game-setup/fields";
import {
  PARTICIPATION_LABELS,
  PRESET_COPY,
  SECTION_IDS,
  leagueAreaLabel,
  type FormStep,
} from "@/components/owner/game-setup/game-setup-helpers";
import {
  ReviewGroup,
  ReviewRow,
} from "@/components/owner/game-setup/setup-shared";

type ReviewStepProps = {
  preset: LeagueSetupPresetId;
  settings: GameSettings;
  name: string;
  rosterSourceLabel: string;
  openingLabel: string;
  controlledLabel: string;
  fantasyOpening: boolean;
  participationMode: ParticipationMode;
  localShared: boolean;
  online: boolean;
  participantSummaries: readonly string[];
  capLabel: string;
  delegationLabel: string;
  historyLabel: string;
  createDisabled: boolean;
  pending: boolean;
  onEdit: (step: FormStep, focusId?: string) => void;
  onBack: () => void;
  onCreate: () => void;
};

export function ReviewStep({
  preset,
  settings,
  name,
  rosterSourceLabel,
  openingLabel,
  controlledLabel,
  fantasyOpening,
  participationMode,
  localShared,
  online,
  participantSummaries,
  capLabel,
  delegationLabel,
  historyLabel,
  createDisabled,
  pending,
  onEdit: goTo,
  onBack,
  onCreate,
}: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <ReviewGroup
        title="League Format"
        onEdit={() => goTo("setup", SECTION_IDS.league)}
      >
        <ReviewRow label="Preset" value={PRESET_COPY[preset].title} />
        <ReviewRow label="Teams" value={String(settings.league.teamCount)} />
        <ReviewRow
          label="Conferences"
          value={String(settings.league.conferenceCount)}
        />
        <ReviewRow
          label="Divisions"
          value={settings.league.divisionsEnabled ? "Enabled" : "Disabled"}
        />
        <ReviewRow
          label="League area"
          value={leagueAreaLabel(settings.league.area ?? "north_america")}
        />
        <ReviewRow
          label="Games per team"
          value={String(settings.regularSeason.gamesPerTeam)}
        />
        <ReviewRow
          label="Playoff teams"
          value={String(settings.playoffs.playoffTeams)}
        />
        <ReviewRow
          label="Series length"
          value={`Best of ${settings.playoffs.seriesLength}`}
        />
      </ReviewGroup>
      <ReviewGroup
        title="Roster and Draft"
        onEdit={() => goTo("setup", SECTION_IDS.roster)}
      >
        <ReviewRow label="Roster source" value={rosterSourceLabel} />
        <ReviewRow label="Opening" value={openingLabel} />
        {fantasyOpening ? (
          <ReviewRow
            label="Fantasy setup"
            value="Configured after franchise selection"
          />
        ) : null}
      </ReviewGroup>
      <ReviewGroup
        title="Save Details"
        onEdit={() => goTo("setup", SECTION_IDS.save)}
      >
        <ReviewRow label="Save name" value={name} />
        <ReviewRow label="Franchise control" value={controlledLabel} />
      </ReviewGroup>
      <ReviewGroup
        title="League Participants"
        onEdit={() => goTo("setup", SECTION_IDS.participants)}
      >
        <ReviewRow
          label="Format"
          value={PARTICIPATION_LABELS[participationMode]}
        />
        {localShared
          ? participantSummaries.map((summary, index) => (
              <ReviewRow
                key={index}
                label={`Player ${index + 1}`}
                value={summary}
              />
            ))
          : null}
        <ReviewRow
          label="After creation"
          value={
            localShared
              ? "Host picks the city, then each player's franchises are assigned"
              : online
                ? "Pick your city and franchises, then invite players"
                : "Choose your city, then your franchises"
          }
        />
      </ReviewGroup>
      <ReviewGroup
        title="Advanced"
        onEdit={() => goTo("advanced", SECTION_IDS.advanced)}
      >
        <ReviewRow
          label="Injury frequency"
          value={INJURY_FREQUENCY_LABELS[settings.injuryFrequency]}
        />
        <ReviewRow label="AI responsibilities" value={delegationLabel} />
        <ReviewRow label="League history" value={historyLabel} />
        <ReviewRow label="Player Salary Cap" value={capLabel} />
        <ReviewRow
          label="Staff Budget"
          value={formatMoney(settings.financialRules.staffBudget)}
        />
        <ReviewRow
          label="Luxury tax"
          value={settings.financialRules.luxuryTaxEnabled ? "On" : "Off"}
        />
        <ReviewRow
          label="Salary floor"
          value={settings.financialRules.salaryFloorEnabled ? "On" : "Off"}
        />
        <ReviewRow
          label="Veteran rights"
          value={settings.financialRules.veteranRightsEnabled ? "On" : "Off"}
        />
        <ReviewRow
          label="Draft lottery"
          value={settings.draftLottery.enabled ? "On" : "Off"}
        />
        <ReviewRow
          label="Restricted free agency"
          value={settings.offseason.restrictedFreeAgency ? "On" : "Off"}
        />
        <ReviewRow
          label="Revenue sharing"
          value={settings.financialRules.revenueSharingEnabled ? "On" : "Off"}
        />
      </ReviewGroup>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          Back
        </button>
        <button
          type="button"
          disabled={createDisabled}
          onClick={onCreate}
          className={primaryButtonClass}
        >
          {pending ? "Creating…" : "Create franchise"}
        </button>
      </div>
    </div>
  );
}
