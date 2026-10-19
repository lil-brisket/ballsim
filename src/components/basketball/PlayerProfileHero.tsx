import { InjuryBadge } from "@/components/basketball/InjuryBadge";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import type { PlayerPortraitAssignment } from "@/domain/entities/player-portrait";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { TeamThemeScope } from "@/components/ui/TeamThemeScope";
import { formatHeight } from "@/presentation/player-rating-categories";
import { ratingTier } from "@/presentation/rating-tier";
import type { TeamBrandingView } from "@/state/team-branding-view";

const HEX_CLIP =
  "polygon(50% 0%, 100% 18%, 100% 78%, 50% 100%, 0% 78%, 0% 18%)";

function Chip(props: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={
        props.accent
          ? "inline-flex items-center rounded bg-team px-2 py-0.5 text-sm font-bold uppercase tracking-wide text-on-team"
          : "inline-flex items-center rounded border border-white/20 bg-black/30 px-2 py-0.5 text-sm uppercase tracking-wide text-zinc-100"
      }
    >
      {props.children}
    </span>
  );
}

function JerseyAndPosition(props: { jerseyNumber: number; position: string }) {
  return (
    <>
      <span className="tabular-nums">#{props.jerseyNumber}</span>
      <span aria-hidden className="mx-1">
        ·
      </span>
      {props.position}
    </>
  );
}

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
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Chip accent>
                <JerseyAndPosition
                  jerseyNumber={props.jerseyNumber}
                  position={props.position}
                />
              </Chip>
              <Chip>{props.teamAbbreviation ?? "FA"}</Chip>
              <Chip>Age {props.age}</Chip>
              {props.archetypeLabel ? (
                <Chip>{props.archetypeLabel}</Chip>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="rounded border border-tier bg-surface-deep px-2 py-0.5 text-sm font-bold tabular-nums text-tier">
              OVR {props.overall}
            </span>
            {props.potential != null ? (
              <span className="rounded-full border border-tier px-2 py-px text-sm font-semibold tabular-nums text-tier">
                POT {props.potential}
              </span>
            ) : null}
          </div>
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
            <div
              className="relative h-36 w-32 sm:h-40 sm:w-36"
              style={{
                filter: "drop-shadow(0 0 14px rgb(var(--tier-rgb) / 0.6))",
              }}
            >
              <div
                className="absolute inset-0 bg-tier"
                style={{ clipPath: HEX_CLIP }}
              />
              <div
                className="absolute inset-[3px] flex flex-col items-center justify-center gap-1 bg-surface-deep"
                style={{ clipPath: HEX_CLIP }}
              >
                <ScoreNumeral
                  value={props.overall}
                  label="OVR"
                  labelBelow
                  size="lg"
                  tone="tier"
                  align="center"
                />
                {props.potential != null ? (
                  <span className="rounded-full border border-tier px-2 py-px text-sm font-semibold tabular-nums text-tier">
                    POT {props.potential}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="order-3 col-span-2 min-w-0 pb-4 sm:order-2 sm:col-span-1 sm:pb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-200">
              {props.firstName}
            </p>
            <h3 className="font-display break-words text-4xl font-extrabold uppercase leading-none tracking-wide text-white [text-shadow:0_2px_12px_rgb(0_0_0_/_0.5)] sm:text-6xl">
              {props.lastName}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Chip accent>
                <JerseyAndPosition
                  jerseyNumber={props.jerseyNumber}
                  position={props.position}
                />
              </Chip>
              {props.archetypeLabel ? (
                <Chip>{props.archetypeLabel}</Chip>
              ) : null}
              {props.heightInches != null ? (
                <Chip>{formatHeight(props.heightInches)}</Chip>
              ) : null}
              {props.weightPounds != null ? (
                <Chip>{props.weightPounds} lbs</Chip>
              ) : null}
              <Chip>Age {props.age}</Chip>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-100">
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
