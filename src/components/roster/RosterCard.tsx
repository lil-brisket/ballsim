import { MoodChip } from "@/components/basketball/MoodChip";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { ContractSummary } from "@/components/owner/ContractSummary";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PlayerActionMenu } from "@/components/roster/PlayerActionMenu";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import {
  cn,
  focusRingClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { ratingTier } from "@/presentation/rating-tier";
import type { RosterPagePlayerView } from "@/state/roster-page-selectors";

/**
 * Roster card: large portrait on a team-colour plate, overall as the dominant
 * number with a tier-coloured edge, then position, role, status and contract.
 */
export function RosterCard(props: {
  saveId: string;
  player: RosterPagePlayerView;
  returnPath: string;
}) {
  const { player } = props;
  const tier = ratingTier(player.overall);
  const name = `${player.firstName} ${player.lastName}`;
  const expiring =
    player.contractYearsRemaining != null && player.contractYearsRemaining <= 1;

  return (
    <div data-tier={tier.id}>
      <ArenaPanel
        as="article"
        raised
        density="compact"
        className="hover-lift space-y-3 border-l-4 border-l-tier !overflow-visible"
      >
        <div className="flex items-start gap-3">
          <span
            className="inline-flex shrink-0 rounded-xl border border-team-ink/30 p-1"
            style={{
              background:
                "linear-gradient(160deg, rgb(var(--team-primary-rgb) / 0.85), rgb(var(--team-primary-rgb) / 0.25))",
            }}
          >
            <PlayerPortrait
              playerId={player.playerId}
              portrait={player.portrait}
              firstName={player.firstName}
              lastName={player.lastName}
              size="lg"
            />
          </span>
          <div className="min-w-0 flex-1">
            <PlayerEntityLink
              saveId={props.saveId}
              playerId={player.playerId}
              className={cn(
                touchTargetTextClass,
                "block max-w-full whitespace-normal rounded px-0 text-left font-display text-xl font-bold uppercase leading-tight tracking-wide text-zinc-50 hover:text-team-ink",
                focusRingClass,
              )}
            >
              {name}
            </PlayerEntityLink>
            <p className="text-sm text-zinc-300">
              {player.position} · Age {player.age}
            </p>
            <p className="mt-0.5 text-sm text-zinc-400">
              {player.roleDisplayLabel}
              {player.depthSlot ? (
                <span className="ml-1 text-sm text-zinc-500">
                  ({player.depthSlot})
                </span>
              ) : null}
            </p>
          </div>
          <ScoreNumeral
            value={player.overall}
            label="OVR"
            labelBelow
            size="lg"
            tone="tier"
            align="end"
            className="shrink-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={player.availabilityLabel}
            tone={player.canPlay ? "available" : player.injuryKind}
          />
          <MoodChip mood={player.mood} />
          {player.onTradeBlock ? (
            <span className="rounded-full border border-team-ink/50 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wide text-team-ink">
              On block
            </span>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-2 border-t border-surface-line pt-2 text-sm">
          <div className="min-w-0">
            <ContractSummary
              salary={player.contractSalary}
              endYear={player.contractEndYear}
              yearsRemaining={player.contractYearsRemaining}
            />
            {expiring && player.contractEndYear != null ? (
              <span className="mt-0.5 block text-sm text-warning">
                {player.contractEndYear} expiring
              </span>
            ) : null}
          </div>
          <PlayerActionMenu
            saveId={props.saveId}
            playerId={player.playerId}
            playerName={name}
            onTradeBlock={player.onTradeBlock}
            returnPath={props.returnPath}
          />
        </div>
      </ArenaPanel>
    </div>
  );
}
