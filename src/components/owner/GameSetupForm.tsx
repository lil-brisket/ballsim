"use client";

import type { ReactNode } from "react";
import {
  AiManagementSection,
  FinancialRulesSection,
  HistorySection,
  InjuriesSection,
} from "@/components/owner/game-setup/AdvancedSections";
import { LeagueFormatSection } from "@/components/owner/game-setup/LeagueFormatSection";
import { ParticipantsSection } from "@/components/owner/game-setup/ParticipantsSection";
import { ReviewStep } from "@/components/owner/game-setup/ReviewStep";
import { RosterDraftSection } from "@/components/owner/game-setup/RosterDraftSection";
import { SaveDetailsSection } from "@/components/owner/game-setup/SaveDetailsSection";
import {
  AdvancedStepActions,
  SetupStepActions,
} from "@/components/owner/game-setup/StepActions";
import { SummaryAside } from "@/components/owner/game-setup/SummaryAside";
import type { FormStep } from "@/components/owner/game-setup/game-setup-helpers";
import { ErrorList } from "@/components/owner/game-setup/setup-shared";
import { useGameSetupForm } from "@/components/owner/game-setup/use-game-setup-form";
import {
  OnboardingShell,
  OnboardingSteps,
} from "@/components/game/OnboardingShell";

type GameSetupFormProps = {
  atSaveLimit: boolean;
  defaultName?: string;
  /** True when the page loaded after a server-side create error. */
  restoreDraft?: boolean;
  /** Server-rendered notices (errors, save limit) shown under the header. */
  notices?: ReactNode;
  /** Username of the signed-in account; required to host an online league. */
  signedInAs?: string | null;
};

const STEP_COPY: Record<FormStep, { title: string; subtitle: string }> = {
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

export function GameSetupForm({
  atSaveLimit,
  defaultName = "Harbor Franchise",
  restoreDraft = false,
  notices,
  signedInAs = null,
}: GameSetupFormProps) {
  const form = useGameSetupForm({
    atSaveLimit,
    defaultName,
    restoreDraft,
    signedInAs,
  });
  const { settings, step, errors, blockedReason, goTo, updateSettings } = form;

  const stepperActive = step === "setup" ? "setup" : "advanced";

  function frame(content: ReactNode) {
    return (
      <OnboardingShell
        step={stepperActive}
        title={STEP_COPY[step].title}
        subtitle={STEP_COPY[step].subtitle}
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

  if (step === "confirm") {
    return frame(
      <ReviewStep
        preset={form.preset}
        settings={settings}
        name={form.name}
        rosterSourceLabel={form.rosterSourceLabel}
        openingLabel={form.openingLabel}
        controlledLabel={form.controlledLabel}
        fantasyOpening={form.fantasyOpening}
        participationMode={form.participationMode}
        localShared={form.localShared}
        online={form.online}
        participantSummaries={form.participantSummaries}
        capLabel={form.capLabel}
        delegationLabel={form.delegationLabel}
        historyLabel={form.historyLabel}
        createDisabled={
          form.pending ||
          atSaveLimit ||
          !form.validation.ok ||
          !form.participationSetup.ok ||
          form.customRosterInvalid
        }
        pending={form.pending}
        onEdit={goTo}
        onBack={() => goTo(form.cameFrom)}
        onCreate={form.submit}
      />,
    );
  }

  const errorsBlock = errors.length > 0 ? <ErrorList errors={errors} /> : null;

  const summaryAside = (
    <SummaryAside
      preset={form.preset}
      settings={settings}
      rosterSourceLabel={form.rosterSourceLabel}
      openingLabel={form.openingLabel}
      controlledLabel={form.controlledLabel}
      participationMode={form.participationMode}
      localShared={form.localShared}
      participantSummaries={form.participantSummaries}
      capLabel={form.capLabel}
      blockedReason={blockedReason}
    />
  );

  if (step === "advanced") {
    return frame(
      <div className="gap-6 space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:space-y-0">
        <div className="space-y-6">
          <InjuriesSection
            settings={settings}
            summary={form.injurySummary}
            onSettingsChange={updateSettings}
          />
          <AiManagementSection
            settings={settings}
            summary={form.delegationLabel}
            onSettingsChange={updateSettings}
          />
          <HistorySection
            settings={settings}
            onSettingsChange={updateSettings}
          />
          <FinancialRulesSection
            settings={settings}
            summary={form.financialSummary}
            onSettingsChange={updateSettings}
          />

          {errorsBlock}

          <AdvancedStepActions
            blockedReason={blockedReason}
            onBack={() => goTo("setup")}
            onReview={() => goTo("confirm")}
          />
        </div>
        {summaryAside}
      </div>,
    );
  }

  return frame(
    <div className="gap-6 space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:space-y-0">
      <div className="space-y-6">
        <LeagueFormatSection
          preset={form.preset}
          settings={settings}
          rosterTeamCountLocked={form.rosterTeamCountLocked}
          onPresetChange={form.applyPreset}
          onSettingsChange={updateSettings}
        />
        <RosterDraftSection
          settings={settings}
          useCustomRoster={form.useCustomRoster}
          fantasyOpening={form.fantasyOpening}
          rosterDropped={form.rosterDropped}
          rosterPackageJson={form.rosterPackageJson}
          onRosterSourceChange={form.setRosterSource}
          onOpeningChange={form.setOpening}
          onPackageJsonChange={form.handleRosterPackageJsonChange}
        />
        <SaveDetailsSection
          name={form.name}
          atSaveLimit={atSaveLimit}
          settings={settings}
          localShared={form.localShared}
          participantsTotal={form.participantsTotal}
          onNameChange={form.setName}
          onSettingsChange={updateSettings}
        />
        <ParticipantsSection
          participationMode={form.participationMode}
          options={form.participationOptionList}
          signedInAs={signedInAs}
          online={form.online}
          localShared={form.localShared}
          participants={form.participants}
          participantsTotal={form.participantsTotal}
          maxControlled={form.maxControlled}
          participationErrors={form.participationErrors}
          onModeChange={form.setParticipationMode}
          onParticipantCountChange={form.setParticipantCount}
          onParticipantChange={form.updateParticipant}
        />

        {errorsBlock}

        <SetupStepActions
          blockedReason={blockedReason}
          onNext={() => goTo("advanced")}
          onSkipToReview={() => goTo("confirm")}
          onReset={form.reset}
        />
      </div>
      {summaryAside}
    </div>,
  );
}
