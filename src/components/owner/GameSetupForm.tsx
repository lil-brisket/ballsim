"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  INJURY_FREQUENCY_LABELS,
  SUPPORTED_GAMES_PER_TEAM,
  SUPPORTED_PLAYOFF_TEAM_COUNTS,
  SUPPORTED_SERIES_LENGTHS,
  SUPPORTED_TEAM_COUNTS,
  LEAGUE_AREA_LABELS,
  LEAGUE_AREA_OPTIONS,
  isSupportedTeamCount,
  maxControlledTeamCountForLeague,
  type GameSettings,
  type LeagueArea,
  type SeriesLength,
} from "@/domain/game-settings";
import {
  applyCustomRosterTeamCount,
  isLockedCustomRosterTeamCount,
} from "@/domain/custom-roster-setup";
import {
  countDelegatedVisiblePhases,
  visibleDelegationPhaseCount,
} from "@/domain/ai-management-delegation";
import {
  resetSettingsForPreset,
  settingsForPreset,
  type LeagueSetupPresetId,
} from "@/domain/game-settings-presets";
import { validateGameSettings } from "@/domain/game-settings-validation";
import { createSaveAction } from "@/application/actions";
import {
  CustomRosterPackageField,
  customRosterHasErrors,
} from "@/components/owner/CustomRosterPackageField";
import { rosterTeamCountFromPackageJson } from "@/systems/custom-content";
import { AiTeamManagementSection } from "@/components/owner/ai-management";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import {
  clearNewGameDraft,
  loadNewGameDraft,
  saveNewGameDraft,
} from "@/components/owner/game-setup/draft-storage";
import {
  FieldGrid,
  InjuryFrequencyField,
  MoneyInputField,
  SelectField,
  SetupSection,
  ToggleField,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/owner/game-setup/fields";
import {
  RadioCardGroup,
  type RadioCardOption,
} from "@/components/owner/game-setup/RadioCardGroup";
import { cn, focusRingClass } from "@/components/ui/styles";
import {
  OnboardingShell,
  OnboardingSteps,
} from "@/components/game/OnboardingShell";
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

type GameSetupFormProps = {
  atSaveLimit: boolean;
  defaultName?: string;
  /** True when the page loaded after a server-side create error. */
  restoreDraft?: boolean;
  /** Server-rendered notices (errors, save limit) shown under the header. */
  notices?: ReactNode;
};

type FormStep = "setup" | "advanced" | "confirm";

type RosterSourceId = "generated" | "custom";
type OpeningId = "assigned" | "fantasy";

const SECTION_IDS = {
  league: "setup-league-format",
  roster: "setup-roster-and-draft",
  save: "setup-save-details",
  advanced: "advanced-injuries",
  ai: "advanced-ai",
  history: "advanced-history",
  financial: "advanced-financial",
} as const;

const ROSTER_SOURCE_OPTIONS: ReadonlyArray<RadioCardOption<RosterSourceId>> = [
  {
    value: "generated",
    title: "Generated rosters",
    description: "The league creates every team's roster for you.",
  },
  {
    value: "custom",
    title: "Imported roster package",
    description:
      "Load a JSON roster package. League size is set by the package's team count.",
  },
];

const OPENING_OPTIONS: ReadonlyArray<RadioCardOption<OpeningId>> = [
  {
    value: "assigned",
    title: "Assigned team rosters",
    description: "Each team starts with its roster.",
  },
  {
    value: "fantasy",
    title: "Fantasy draft",
    description:
      "All players enter a pool and teams draft from scratch. Draft order, timer and snake/linear format are configured after you choose your franchises.",
  },
];

const PRESET_COPY: Record<
  LeagueSetupPresetId,
  { title: string; text: string }
> = {
  standard: {
    title: "Standard",
    text: "A full-size league with a full-length season.",
  },
  cbl: {
    title: "CBL",
    text: "The classic compact league with a short season.",
  },
  custom: {
    title: "Custom",
    text: "Start from your current settings and edit any rule.",
  },
};

function leagueNumbers(settings: GameSettings): string {
  return `${settings.league.teamCount} teams · ${settings.regularSeason.gamesPerTeam} games · ${settings.playoffs.playoffTeams} playoff teams · best of ${settings.playoffs.seriesLength}`;
}

export function GameSetupForm({
  atSaveLimit,
  defaultName = "Harbor Franchise",
  restoreDraft = false,
  notices,
}: GameSetupFormProps) {
  const [preset, setPreset] = useState<LeagueSetupPresetId>("standard");
  const [settings, setSettings] = useState<GameSettings>(() =>
    settingsForPreset("standard"),
  );
  const [name, setName] = useState(defaultName);
  const [step, setStep] = useState<FormStep>("setup");
  const [cameFrom, setCameFrom] = useState<"setup" | "advanced">("setup");
  const [pending, startTransition] = useTransition();
  const [rosterPackageJson, setRosterPackageJson] = useState("");
  const [useCustomRoster, setUseCustomRoster] = useState(false);
  const [rosterDropped, setRosterDropped] = useState(false);
  const pendingFocusId = useRef<string | null>(null);

  const validation = useMemo(() => validateGameSettings(settings), [settings]);
  const errors = validation.ok ? [] : validation.errors;
  const loadedRosterTeamCount =
    rosterTeamCountFromPackageJson(rosterPackageJson);
  const rosterTeamCountLocked = isLockedCustomRosterTeamCount(
    loadedRosterTeamCount,
  );
  const customRosterInvalid =
    useCustomRoster &&
    customRosterHasErrors(
      rosterPackageJson,
      settings.league.teamCount,
      settings.financialRules.salaryCap,
      settings.financialRules.salaryCapEnabled,
    );
  const fantasyOpening = settings.draft.mode === "fantasy";

  // Restore after a server-side error redirect; otherwise drop any stale draft.
  // Done in an effect so server and first client render match.
  /* eslint-disable react-hooks/set-state-in-effect -- restore client-only sessionStorage draft after hydration */
  useEffect(() => {
    if (!restoreDraft) {
      clearNewGameDraft();
      return;
    }
    const draft = loadNewGameDraft();
    if (!draft) {
      return;
    }
    setName(draft.name);
    setPreset(draft.preset);
    setSettings(draft.settings);
    setUseCustomRoster(draft.useCustomRoster);
    setRosterPackageJson(draft.rosterPackageJson);
    setRosterDropped(draft.rosterDropped);
  }, [restoreDraft]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (pendingFocusId.current === null) {
      return;
    }
    document.getElementById(pendingFocusId.current)?.focus();
    pendingFocusId.current = null;
  }, [step]);

  function settingsWithLoadedRoster(base: GameSettings): GameSettings {
    if (!isLockedCustomRosterTeamCount(loadedRosterTeamCount)) {
      return base;
    }
    return applyCustomRosterTeamCount(base, loadedRosterTeamCount);
  }

  function applyPreset(next: LeagueSetupPresetId) {
    const nextSettings = settingsWithLoadedRoster(
      settingsForPreset(next, settings),
    );
    setPreset(
      isLockedCustomRosterTeamCount(loadedRosterTeamCount) ? "custom" : next,
    );
    setSettings(nextSettings);
  }

  function updateSettings(next: GameSettings) {
    const max = maxControlledTeamCountForLeague(next.league.teamCount);
    const controlledTeamCount = Math.min(
      Math.max(1, next.ownership?.controlledTeamCount ?? 1),
      max,
    );
    setPreset("custom");
    setSettings({
      ...next,
      ownership: { controlledTeamCount },
    });
  }

  function reset() {
    setSettings(settingsWithLoadedRoster(resetSettingsForPreset(preset)));
  }

  function handleRosterPackageJsonChange(value: string) {
    setRosterPackageJson(value);
    setUseCustomRoster(value.length > 0);
    if (value.length > 0) {
      setRosterDropped(false);
    }
    const teamCount = rosterTeamCountFromPackageJson(value);
    if (teamCount === null || !isSupportedTeamCount(teamCount)) {
      return;
    }
    updateSettings(applyCustomRosterTeamCount(settings, teamCount));
  }

  const blockedReason: string | null = atSaveLimit
    ? "You have reached the save limit. Delete a save to create another."
    : errors.length > 0
      ? `Fix ${errors.length} ${errors.length === 1 ? "issue" : "issues"} above.`
      : customRosterInvalid
        ? "Upload a valid roster package."
        : null;

  function submit() {
    if (!validation.ok || atSaveLimit || customRosterInvalid) {
      return;
    }
    saveNewGameDraft({
      name,
      preset,
      settings,
      useCustomRoster,
      rosterPackageJson,
    });
    const formData = new FormData();
    formData.set("name", name);
    formData.set("settingsJson", JSON.stringify(settings));
    if (useCustomRoster) {
      formData.set("rosterPackageJson", rosterPackageJson);
    }
    startTransition(() => {
      void createSaveAction(formData);
    });
  }

  function goTo(next: FormStep, focusId?: string) {
    if (next === "confirm") {
      setCameFrom(step === "advanced" ? "advanced" : "setup");
    }
    pendingFocusId.current = focusId ?? "onboarding-header";
    setStep(next);
  }

  function applyDraftMode(mode: GameSettings["draft"]["mode"]) {
    updateSettings({
      ...settings,
      draft: {
        ...settings.draft,
        mode,
        type: settings.draft.type ?? "snake",
        timerSeconds: settings.draft.timerSeconds ?? null,
        orderMode: settings.draft.orderMode ?? "random",
        userPickPosition: null,
        randomizeUserPick: false,
      },
    });
  }

  function setRosterSource(source: RosterSourceId) {
    if (source === "generated") {
      setRosterPackageJson("");
      setUseCustomRoster(false);
      applyDraftMode(fantasyOpening ? "fantasy" : "standard");
      return;
    }
    setUseCustomRoster(true);
    applyDraftMode(fantasyOpening ? "fantasy" : "custom");
  }

  function setOpening(opening: OpeningId) {
    applyDraftMode(
      opening === "fantasy"
        ? "fantasy"
        : useCustomRoster
          ? "custom"
          : "standard",
    );
  }

  const rosterSourceLabel = useCustomRoster
    ? "Imported roster package"
    : "Generated rosters";
  const openingLabel = fantasyOpening
    ? "Fantasy draft"
    : "Assigned team rosters";
  const controlledLabel =
    settings.ownership.controlledTeamCount === 1
      ? "1 team"
      : `${settings.ownership.controlledTeamCount} teams`;
  const capLabel = settings.financialRules.salaryCapEnabled
    ? formatMoney(settings.financialRules.salaryCap)
    : "Off";
  const delegationLabel = `${countDelegatedVisiblePhases(settings.ai.assistance)} of ${visibleDelegationPhaseCount()} delegated to AI`;
  const historyLabel =
    settings.history.mode === "generated" ? "Generated" : "New league";

  const stepperActive = step === "setup" ? "setup" : "advanced";
  const stepCopy: Record<FormStep, { title: string; subtitle: string }> = {
    setup: {
      title: "Game setup",
      subtitle:
        "Configure league rules for this Owner Mode career. Settings are saved with the franchise and drive simulation. A save is created only when you confirm below.",
    },
    advanced: {
      title: "Advanced settings",
      subtitle:
        "Optional. These apply to every preset; editing one switches the preset to Custom.",
    },
    confirm: {
      title: "Review and create",
      subtitle: "Review your league rules before creating the franchise save.",
    },
  };

  function frame(content: ReactNode) {
    return (
      <OnboardingShell
        step={stepperActive}
        title={stepCopy[step].title}
        subtitle={stepCopy[step].subtitle}
        steps={
          <OnboardingSteps
            step={stepperActive}
            onSelect={{
              setup: () => goTo("setup"),
              advanced: () => goTo("advanced"),
            }}
          />
        }
      >
        {notices}
        {content}
      </OnboardingShell>
    );
  }

  const errorsBlock =
    errors.length > 0 ? (
      <ul
        role="alert"
        className="space-y-1 rounded-md border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-300"
      >
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    ) : null;

  const blockedNote = blockedReason ? (
    <p id="review-blocked-reason" className="text-sm text-zinc-400">
      {blockedReason}
    </p>
  ) : null;
  const describedBy = blockedReason ? "review-blocked-reason" : undefined;

  const summaryAside = (
    <aside
      aria-labelledby="setup-summary-heading"
      className="mt-6 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 lg:sticky lg:top-6 lg:mt-0"
    >
      <h2
        id="setup-summary-heading"
        className="text-base font-semibold text-zinc-100"
      >
        Summary
      </h2>
      <dl className="space-y-2 text-sm">
        <SummaryRow label="Preset" value={PRESET_COPY[preset].title} />
        <SummaryRow label="Teams" value={String(settings.league.teamCount)} />
        <SummaryRow
          label="Games"
          value={String(settings.regularSeason.gamesPerTeam)}
        />
        <SummaryRow
          label="Playoffs"
          value={`${settings.playoffs.playoffTeams} teams, best of ${settings.playoffs.seriesLength}`}
        />
        <SummaryRow label="Roster source" value={rosterSourceLabel} />
        <SummaryRow label="Opening" value={openingLabel} />
        <SummaryRow label="Controlled teams" value={controlledLabel} />
        <SummaryRow label="Salary cap" value={capLabel} />
      </dl>
      <p aria-live="polite" className="text-xs text-zinc-400">
        {blockedReason ? "Not ready to review yet." : "Ready to review."}
      </p>
    </aside>
  );

  if (step === "confirm") {
    return frame(
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
            label="Revenue sharing"
            value={settings.financialRules.revenueSharingEnabled ? "On" : "Off"}
          />
        </ReviewGroup>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => goTo(cameFrom)}
            className={secondaryButtonClass}
          >
            Back
          </button>
          <button
            type="button"
            disabled={
              pending || atSaveLimit || !validation.ok || customRosterInvalid
            }
            onClick={submit}
            className={primaryButtonClass}
          >
            {pending ? "Creating…" : "Create franchise"}
          </button>
        </div>
      </div>,
    );
  }

  const presetOptions: ReadonlyArray<RadioCardOption<LeagueSetupPresetId>> = (
    ["standard", "cbl", "custom"] as const
  ).map((id) => ({
    value: id,
    title: PRESET_COPY[id].title,
    description: PRESET_COPY[id].text,
    meta: leagueNumbers(id === "custom" ? settings : settingsForPreset(id)),
  }));

  const injurySummary = INJURY_FREQUENCY_LABELS[settings.injuryFrequency];
  const financialSummary = `Cap ${capLabel}, Luxury tax ${settings.financialRules.luxuryTaxEnabled ? "on" : "off"}`;

  const blockedButtons = blockedReason !== null;

  if (step === "advanced") {
    return frame(
      <div className="gap-6 space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:space-y-0">
        <div className="space-y-6">
          <SetupSection
            id={SECTION_IDS.advanced}
            title="Injuries"
            description={`Current: ${injurySummary}`}
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

          <SetupSection
            id={SECTION_IDS.ai}
            title="AI Team Management"
            description={`Current: ${delegationLabel}`}
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

          <SetupSection
            id={SECTION_IDS.financial}
            title="Financial Rules"
            description={`Current: ${financialSummary}`}
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
            </FieldGrid>
          </SetupSection>

          {errorsBlock}

          <div className="space-y-2">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => goTo("setup")}
                className={secondaryButtonClass}
              >
                Back
              </button>
              <button
                type="button"
                disabled={blockedButtons}
                aria-describedby={describedBy}
                onClick={() => goTo("confirm")}
                className={primaryButtonClass}
              >
                Review and create
              </button>
            </div>
            {blockedNote}
          </div>
        </div>
        {summaryAside}
      </div>,
    );
  }

  return frame(
    <div className="gap-6 space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:space-y-0">
      <div className="space-y-6">
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
            onChange={applyPreset}
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
                <p className="text-xs text-zinc-500">
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

        <SetupSection id={SECTION_IDS.roster} title="Roster and Draft">
          <RadioCardGroup
            legend="Roster source"
            options={ROSTER_SOURCE_OPTIONS}
            value={useCustomRoster ? "custom" : "generated"}
            onChange={setRosterSource}
          />
          <RadioCardGroup
            legend="Opening"
            options={OPENING_OPTIONS}
            value={fantasyOpening ? "fantasy" : "assigned"}
            onChange={setOpening}
          />
          {useCustomRoster ? (
            <div className="space-y-3">
              {rosterDropped && rosterPackageJson.length === 0 ? (
                <p
                  role="status"
                  className="rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-200"
                >
                  Your roster package was too large to keep — upload it again.
                </p>
              ) : null}
              <CustomRosterPackageField
                teamCount={settings.league.teamCount}
                salaryCap={settings.financialRules.salaryCap}
                salaryCapEnabled={settings.financialRules.salaryCapEnabled}
                packageJson={rosterPackageJson}
                onPackageJsonChange={handleRosterPackageJsonChange}
              />
            </div>
          ) : null}
          {fantasyOpening && useCustomRoster ? (
            <p className="text-sm text-zinc-400">
              Imported players enter the pool; generated players fill out 15-man
              drafts. Anyone not drafted becomes a free agent.
            </p>
          ) : null}
        </SetupSection>

        <SetupSection id={SECTION_IDS.save} title="Save Details">
          <div className="space-y-1">
            <label className="block text-sm text-zinc-300" htmlFor="save-name">
              Save name
            </label>
            <input
              id="save-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={atSaveLimit}
              className={inputClass}
            />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-200">
              Franchise control
            </p>
            <p className="text-sm text-zinc-400">
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
          </div>
        </SetupSection>

        {errorsBlock}

        <div className="space-y-2">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={blockedButtons}
              aria-describedby={describedBy}
              onClick={() => goTo("advanced")}
              className={primaryButtonClass}
            >
              Next: Advanced settings
            </button>
            <button
              type="button"
              disabled={blockedButtons}
              aria-describedby={describedBy}
              onClick={() => goTo("confirm")}
              className={secondaryButtonClass}
            >
              Skip to review
            </button>
            <button
              type="button"
              onClick={reset}
              className={secondaryButtonClass}
            >
              Reset to defaults
            </button>
          </div>
          {blockedNote}
        </div>
      </div>
      {summaryAside}
    </div>,
  );
}

function leagueAreaIndex(area: LeagueArea): number {
  const index = LEAGUE_AREA_OPTIONS.indexOf(area);
  return index >= 0 ? index : 0;
}

function leagueAreaLabel(area: LeagueArea): string {
  return LEAGUE_AREA_LABELS[area];
}

function ControlButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-md px-3 py-1.5 text-sm",
        focusRingClass,
        selected
          ? "bg-amber-600 text-zinc-950"
          : "border border-zinc-700 text-zinc-300 hover:border-amber-600",
      )}
    >
      {children}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium text-zinc-100">{value}</dd>
    </div>
  );
}

function ReviewGroup({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${title}`}
          className={secondaryButtonClass}
        >
          Edit
        </button>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-zinc-100">{value}</dd>
    </div>
  );
}
