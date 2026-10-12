import { InjuryBadge } from "@/components/basketball/InjuryBadge";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { TeamThemeScope } from "@/components/ui/TeamThemeScope";
import { ratingTier } from "@/presentation/rating-tier";
import type { TeamBrandingView } from "@/state/team-branding-view";

/**
 * Large portrait on a plate in the player's team colours, with the overall
 * rating as the dominant element. Themed by the player's team (neutral amber
 * for free agents), not by the controlled franchise.
 */
export function PlayerProfileHero(props: {
  playerId: string;
  firstName: string;
  lastName: string;
  /** Persisted portrait from the view model; null/absent → initials plate. */
  portrait?: PlayerPortraitAssignment | null;
  position: string;
  age: number;
  overall: number;
  teamName: string | null;
  teamAbbreviation: string | null;
  branding: TeamBrandingView | null;
  availabilityStatus: string;
}) {
  const name = `${props.firstName} ${props.lastName}`;
  const teamLabel = props.teamName ?? "Free agent";
  const tier = ratingTier(props.overall);

  return (
    <TeamThemeScope branding={props.branding}>
      <ArenaPanel
        as="div"
        hero
        edge="left"
        density="comfortable"
        className="enter-up"
      >
        <div
          data-tier={tier.id}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6"
        >
          <span
            className="inline-flex shrink-0 self-start rounded-2xl border border-team-ink/40 p-2 sm:self-center"
            style={{
              background:
                "linear-gradient(160deg, var(--team-primary), rgb(var(--team-primary-rgb) / 0.35))",
            }}
          >
            <PlayerPortrait
              playerId={props.playerId}
              firstName={props.firstName}
              lastName={props.lastName}
              portrait={props.portrait}
              size="lg"
            />
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="font-display text-3xl font-extrabold uppercase leading-none tracking-wide text-zinc-50 sm:text-4xl">
              {name}
            </h3>
            <p className="mt-1.5 font-mono text-xs uppercase tracking-[0.14em] text-zinc-300">
              {props.position} · Age {props.age}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-200">
              {props.branding ? (
                <TeamBadge
                  branding={props.branding}
                  name={teamLabel}
                  size="sm"
                  decorative
                />
              ) : props.teamAbbreviation ? (
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-team-ink/40 px-1 font-mono text-[10px] font-semibold text-team-ink">
                  {props.teamAbbreviation}
                </span>
              ) : null}
              <span>{teamLabel}</span>
            </p>
            <div className="mt-3">
              <InjuryBadge status={props.availabilityStatus} />
            </div>
          </div>

          <div className="shrink-0 self-start rounded-xl border-2 border-tier bg-surface-deep/60 px-5 py-3 sm:self-center">
            <ScoreNumeral
              value={props.overall}
              label="Overall"
              labelBelow
              size="xl"
              tone="tier"
              align="center"
            />
          </div>
        </div>
      </ArenaPanel>
    </TeamThemeScope>
  );
}
