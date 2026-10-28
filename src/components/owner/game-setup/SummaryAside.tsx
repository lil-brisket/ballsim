import type { GameSettings } from "@/domain/game-settings";
import type { LeagueSetupPresetId } from "@/domain/game-settings-presets";
import type { ParticipationMode } from "@/domain/participation";
import {
  PARTICIPATION_LABELS,
  PRESET_COPY,
} from "@/components/owner/game-setup/game-setup-helpers";
import { SummaryRow } from "@/components/owner/game-setup/setup-shared";
import { SectionHeading } from "@/components/ui/SectionHeading";

type SummaryAsideProps = {
  preset: LeagueSetupPresetId;
  settings: GameSettings;
  rosterSourceLabel: string;
  openingLabel: string;
  controlledLabel: string;
  participationMode: ParticipationMode;
  localShared: boolean;
  participantSummaries: readonly string[];
  capLabel: string;
  blockedReason: string | null;
};

export function SummaryAside({
  preset,
  settings,
  rosterSourceLabel,
  openingLabel,
  controlledLabel,
  participationMode,
  localShared,
  participantSummaries,
  capLabel,
  blockedReason,
}: SummaryAsideProps) {
  return (
    <aside
      aria-labelledby="setup-summary-heading"
      className="mt-6 space-y-3 rounded-xl border border-line bg-surface-raised/60 p-4 lg:sticky lg:top-6 lg:mt-0"
    >
      <SectionHeading id="setup-summary-heading" title="Summary" />
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
        <SummaryRow
          label="Participants"
          value={PARTICIPATION_LABELS[participationMode]}
        />
        {localShared
          ? participantSummaries.map((summary, index) => (
              <SummaryRow
                key={index}
                label={`Player ${index + 1}`}
                value={summary}
              />
            ))
          : null}
        <SummaryRow label="Salary cap" value={capLabel} />
      </dl>
      <p aria-live="polite" className="text-sm text-muted">
        {blockedReason ? "Not ready to review yet." : "Ready to review."}
      </p>
    </aside>
  );
}
