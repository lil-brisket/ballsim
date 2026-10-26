import { InjuryBadge } from "@/components/basketball/InjuryBadge";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { TeamThemeScope } from "@/components/ui/TeamThemeScope";
import {
  OvrWithPotential,
  PlayerIdentityLine,
} from "@/components/basketball/PlayerIdentityLine";
import { cn, displayClass } from "@/components/ui/styles";
import { ratingTier } from "@/presentation/rating-tier";
import type { TeamBrandingView } from "@/state/team-branding-view";

/**
 * Banner: team-colour gradient, a bottom-anchored portrait, the last name as the dominant headline and a
 * tier-coloured OVR hex badge. Themed by the player's team (neutral amber for
 * free agents), not by the controlled franchise.
 */
export function PlayerProfileHero(props: {
  playerId: string;
  firstName: string;
  lastName: string;
  /** Saved jersey number (0-99), shown as "#23" beside the position. */
  jerseyNumber: number;
  /** Persisted portrait from the view model; null/absent → initials plate. */
  portrait?: PlayerPortraitAssignment | null;
  position: string;
  age: number;
  overall: number;
  potential?: number;
  archetypeLabel?: string;
  heightInches?: number;
  weightPounds?: number;
  /** Pre-formatted "$12.4M · 3y"; omitted when the screen shows it elsewhere. */
  contractSummary?: string | null;
  teamName: string | null;
  teamAbbreviation: string | null;
  branding: TeamBrandingView | null;
  availabilityStatus: string;
  /** "compact" is a single identity row for tabs that scroll long content. */
  variant?: "full" | "compact";
}) {
  const teamLabel = props.teamName ?? "Free agent";
  const tier = ratingTier(props.overall);

  if (props.variant === "compact") {
    return (
      <TeamThemeScope branding={props.branding}>
        <div
          data-tier={tier.id}
          data-hero-variant="compact"
          className="flex items-center gap-3 overflow-hidden rounded-xl border border-team-ink/50 px-3 py-2"
          style={{
            background:
              "linear-gradient(135deg, var(--team-primary) 0%, rgb(var(--team-primary-rgb) / 0.55) 55%, var(--surface-deep) 100%)",
          }}
        >
          <span className="inline-flex shrink-0 overflow-hidden rounded-lg">
            <PlayerPortrait
              playerId={props.playerId}
              firstName={props.firstName}
              lastName={props.lastName}
              portrait={props.portrait}
              size="md"
              className="border-0"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-xl font-extrabold uppercase leading-tight tracking-wide text-white sm:text-2xl">
              {props.firstName} {props.lastName}
            </p>
            {props.archetypeLabel ? (
              <p
                className={cn(displayClass, "mt-1 truncate text-base text-ink")}
              >
                {props.archetypeLabel}
              </p>
            ) : null}
            <PlayerIdentityLine
              className="mt-1 text-ink/80"
              jerseyNumber={props.jerseyNumber}
              position={props.position}
              age={props.age}
              heightInches={props.heightInches}
              weightPounds={props.weightPounds}
              contractSummary={props.contractSummary}
            />
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
              {props.branding ? (
                <TeamBadge
                  branding={props.branding}
                  name={teamLabel}
                  size="sm"
                  decorative
                />
              ) : null}
              {props.teamAbbreviation ?? "Free agent"}
            </p>
          </div>
          <OvrWithPotential
            overall={props.overall}
            potential={props.potential}
            age={props.age}
            size="md"
            direction="row"
          />
        </div>
      </TeamThemeScope>
    );
  }

  return (
    <TeamThemeScope branding={props.branding}>
      <div
        data-tier={tier.id}
        className="enter-up relative isolate overflow-hidden rounded-xl border border-team-ink/50"
        style={{
          background:
            "linear-gradient(135deg, var(--team-primary) 0%, rgb(var(--team-primary-rgb) / 0.55) 48%, var(--surface-deep) 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "repeating-linear-gradient(115deg, rgb(255 255 255 / 0.05) 0 10px, transparent 10px 24px)",
          }}
        />
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-4 gap-y-3 px-4 pt-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-6 sm:px-6 sm:pt-6">
          <span
            className="order-1 inline-flex shrink-0 overflow-hidden rounded-t-2xl"
            style={{
              background:
                "linear-gradient(160deg, rgb(255 255 255 / 0.18), rgb(0 0 0 / 0.35))",
            }}
          >
            <PlayerPortrait
              playerId={props.playerId}
              firstName={props.firstName}
              lastName={props.lastName}
              portrait={props.portrait}
              size="xl"
              className="border-0"
            />
          </span>

          <div className="order-2 justify-self-end self-start sm:order-3 sm:self-center sm:pb-5">
            <OvrWithPotential
              overall={props.overall}
              potential={props.potential}
              age={props.age}
              size="xl"
            />
          </div>

          <div className="order-3 col-span-2 min-w-0 pb-4 sm:order-2 sm:col-span-1 sm:pb-5">
            {/* The one small eyebrow allowed above a hero title. */}
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ink">
              {props.firstName}
            </p>
            <h3 className="font-display break-words text-4xl font-extrabold uppercase leading-none tracking-wide text-white [text-shadow:0_2px_12px_rgb(0_0_0_/_0.5)] sm:text-6xl">
              {props.lastName}
            </h3>
            {props.archetypeLabel ? (
              <p className={cn(displayClass, "mt-2 text-xl text-ink")}>
                {props.archetypeLabel}
              </p>
            ) : null}
            <PlayerIdentityLine
              className="mt-2 text-ink/80"
              jerseyNumber={props.jerseyNumber}
              position={props.position}
              age={props.age}
              heightInches={props.heightInches}
              weightPounds={props.weightPounds}
              contractSummary={props.contractSummary}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink">
              {props.branding ? (
                <TeamBadge
                  branding={props.branding}
                  name={teamLabel}
                  size="sm"
                  decorative
                />
              ) : props.teamAbbreviation ? (
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-white/30 px-1 text-sm font-semibold text-white">
                  {props.teamAbbreviation}
                </span>
              ) : null}
              <span className="font-medium">{teamLabel}</span>
              <InjuryBadge status={props.availabilityStatus} />
            </div>
          </div>
        </div>
        <div
          aria-hidden
          className="h-1 w-full"
          style={{
            background:
              "linear-gradient(90deg, var(--team-secondary), transparent)",
          }}
        />
      </div>
    </TeamThemeScope>
  );
}
