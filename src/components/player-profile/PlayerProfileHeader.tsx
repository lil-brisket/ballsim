import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { TeamThemeScope } from "@/components/ui/TeamThemeScope";
import { ratingTier } from "@/presentation/rating-tier";
import type { PlayerProfileView } from "@/state/player-profile-selectors";

/**
 * Full-page profile hero: portrait on a team-colour plate, overall as the
 * dominant number (tier-coloured) with potential beside it. Themed by the
 * player's team.
 */
export function PlayerProfileHeader(props: { player: PlayerProfileView }) {
  const { player } = props;
  const tier = ratingTier(player.overall);
  const teamLabel = player.teamName ?? "Free agent";

  return (
    <TeamThemeScope branding={player.teamBranding}>
      <ArenaPanel
        as="header"
        hero
        edge="left"
        density="comfortable"
        className="space-y-4"
      >
        <div
          data-tier={tier.id}
          className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <span
              className="inline-flex shrink-0 rounded-2xl border border-team-ink/40 p-2"
              style={{
                background:
                  "linear-gradient(160deg, var(--team-primary), rgb(var(--team-primary-rgb) / 0.35))",
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
            <div className="min-w-0">
              <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-zinc-50 sm:text-5xl">
                {player.firstName} {player.lastName}
              </h1>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-300">
                {player.position} · Age {player.age}
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-200">
                {player.teamBranding ? (
                  <TeamBadge
                    branding={player.teamBranding}
                    name={teamLabel}
                    size="sm"
                    decorative
                  />
                ) : null}
                <span>{teamLabel}</span>
              </p>
              <p className="mt-1 text-xs capitalize text-zinc-400">
                {player.archetype.replace(/_/g, " ")} · {player.nationality} ·{" "}
                {player.heightInches}&quot; / {player.weightPounds} lbs
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-xl border-2 border-tier bg-surface-deep/60 px-5 py-3">
              <ScoreNumeral
                value={player.overall}
                label="Overall"
                labelBelow
                size="xl"
                tone="tier"
                align="center"
              />
            </div>
            <div className="rounded-xl border border-surface-line bg-surface-deep/60 px-4 py-3">
              <ScoreNumeral
                value={player.potentialOverall}
                label="Potential"
                labelBelow
                size="lg"
                align="center"
              />
            </div>
            <div className="space-y-1">
              <StatusBadge label={player.developmentStage} />
              <StatusBadge label={player.injuryKind} tone={player.injuryKind} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-surface-line pt-4 text-sm">
          {player.contract ? (
            <>
              <MoneyDisplay amount={player.contract.salary ?? 0} />
              <span className="text-zinc-300">
                {player.contract.startYear}–{player.contract.endYear} (
                {player.contract.yearsRemaining}y)
              </span>
              <StatusBadge label={player.contract.status} />
            </>
          ) : (
            <span className="text-zinc-400">No contract on file</span>
          )}
        </div>
      </ArenaPanel>
    </TeamThemeScope>
  );
}
