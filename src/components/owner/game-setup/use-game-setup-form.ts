import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  INJURY_FREQUENCY_LABELS,
  isSupportedTeamCount,
  maxControlledTeamCountForLeague,
  type GameSettings,
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
import {
  LOCAL_SHARED_LEAGUE_AVAILABLE,
  ONLINE_LEAGUE_AVAILABLE,
  MIN_LOCAL_PARTICIPANTS,
  parseParticipationSetup,
  type LocalParticipantSetup,
  type ParticipationMode,
} from "@/domain/participation";
import { createSaveAction } from "@/application/actions";
import { customRosterHasErrors } from "@/components/owner/CustomRosterPackageField";
import { rosterTeamCountFromPackageJson } from "@/systems/custom-content";
import { formatMoney } from "@/components/owner/MoneyDisplay";
import {
  clearNewGameDraft,
  loadNewGameDraft,
  saveNewGameDraft,
} from "@/components/owner/game-setup/draft-storage";
import {
  defaultParticipants,
  participationOptions,
  teamsLabel,
  type FormStep,
  type OpeningId,
  type RosterSourceId,
} from "@/components/owner/game-setup/game-setup-helpers";

type UseGameSetupFormInput = {
  atSaveLimit: boolean;
  defaultName: string;
  restoreDraft: boolean;
  signedInAs: string | null;
};

/** Owns all setup-form state, derived values and handlers. */
export function useGameSetupForm({
  atSaveLimit,
  defaultName,
  restoreDraft,
  signedInAs,
}: UseGameSetupFormInput) {
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
  const [participationMode, setParticipationMode] =
    useState<ParticipationMode>("single");
  const [participants, setParticipants] = useState<LocalParticipantSetup[]>(
    () => defaultParticipants(MIN_LOCAL_PARTICIPANTS),
  );
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
  const maxControlled = maxControlledTeamCountForLeague(
    settings.league.teamCount,
  );
  const localShared = participationMode === "local_shared";
  const online = participationMode === "online";
  const participationOptionList = useMemo(
    () => participationOptions(signedInAs),
    [signedInAs],
  );
  const participantsTotal = participants.reduce(
    (sum, participant) => sum + participant.teamCount,
    0,
  );
  const participationSetup = useMemo(
    () =>
      parseParticipationSetup(
        localShared
          ? { mode: "local_shared", participants }
          : { mode: online ? "online" : "single" },
        maxControlled,
      ),
    [localShared, online, participants, maxControlled],
  );
  const participationErrors = participationSetup.ok
    ? []
    : participationSetup.errors;

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
    if (draft.participation) {
      const restored = draft.participation.mode;
      setParticipationMode(
        (restored === "local_shared" && !LOCAL_SHARED_LEAGUE_AVAILABLE) ||
          (restored === "online" &&
            !(ONLINE_LEAGUE_AVAILABLE && signedInAs !== null))
          ? "single"
          : restored,
      );
      if (draft.participation.participants.length >= MIN_LOCAL_PARTICIPANTS) {
        setParticipants(draft.participation.participants);
      }
    }
  }, [restoreDraft, signedInAs]);
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

  function updateParticipant(
    index: number,
    patch: Partial<LocalParticipantSetup>,
  ) {
    setParticipants((current) =>
      current.map((participant, i) =>
        i === index ? { ...participant, ...patch } : participant,
      ),
    );
  }

  function setParticipantCount(count: number) {
    setParticipants((current) =>
      count <= current.length
        ? current.slice(0, count)
        : [...current, ...defaultParticipants(count).slice(current.length)],
    );
  }

  const issueCount =
    errors.length + (localShared ? participationErrors.length : 0);
  const blockedReason: string | null = atSaveLimit
    ? "You have reached the save limit. Delete a save to create another."
    : issueCount > 0
      ? `Fix ${issueCount} ${issueCount === 1 ? "issue" : "issues"} above.`
      : customRosterInvalid
        ? "Upload a valid roster package."
        : null;

  function submit() {
    if (
      !validation.ok ||
      !participationSetup.ok ||
      atSaveLimit ||
      customRosterInvalid
    ) {
      return;
    }
    saveNewGameDraft({
      name,
      preset,
      settings,
      useCustomRoster,
      rosterPackageJson,
      participation: { mode: participationMode, participants },
    });
    const formData = new FormData();
    formData.set("name", name);
    formData.set("settingsJson", JSON.stringify(settings));
    formData.set("participationJson", JSON.stringify(participationSetup.value));
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
  const controlledLabel = teamsLabel(
    localShared ? participantsTotal : settings.ownership.controlledTeamCount,
  );
  const participantSummaries = participants.map((participant, index) => {
    const playerName = participant.displayName.trim() || `Player ${index + 1}`;
    return `${playerName}${index === 0 ? " (host)" : ""} — ${teamsLabel(participant.teamCount)}`;
  });
  const capLabel = settings.financialRules.salaryCapEnabled
    ? formatMoney(settings.financialRules.salaryCap)
    : "Off";
  const delegationLabel = `${countDelegatedVisiblePhases(settings.ai.assistance)} of ${visibleDelegationPhaseCount()} delegated to AI`;
  const historyLabel =
    settings.history.mode === "generated" ? "Generated" : "New league";
  const injurySummary = INJURY_FREQUENCY_LABELS[settings.injuryFrequency];
  const financialSummary = `Cap ${capLabel}, Luxury tax ${settings.financialRules.luxuryTaxEnabled ? "on" : "off"}`;

  return {
    // state
    preset,
    settings,
    name,
    step,
    cameFrom,
    pending,
    rosterPackageJson,
    useCustomRoster,
    rosterDropped,
    participationMode,
    participants,
    // validation and derived values
    validation,
    errors,
    rosterTeamCountLocked,
    customRosterInvalid,
    fantasyOpening,
    maxControlled,
    localShared,
    online,
    participationOptionList,
    participantsTotal,
    participationSetup,
    participationErrors,
    blockedReason,
    // labels
    rosterSourceLabel,
    openingLabel,
    controlledLabel,
    participantSummaries,
    capLabel,
    delegationLabel,
    historyLabel,
    injurySummary,
    financialSummary,
    // actions
    setName,
    setParticipationMode,
    applyPreset,
    updateSettings,
    reset,
    handleRosterPackageJsonChange,
    updateParticipant,
    setParticipantCount,
    submit,
    goTo,
    setRosterSource,
    setOpening,
  };
}

export type GameSetupFormState = ReturnType<typeof useGameSetupForm>;
