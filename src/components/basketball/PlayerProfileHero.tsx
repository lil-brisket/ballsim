import { InjuryBadge } from "@/components/basketball/InjuryBadge";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { TeamBrandingView } from "@/state/team-branding-view";

function initials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase();
}

export function PlayerProfileHero(props: {
  firstName: string;
  lastName: string;
  position: string;
  age: number;
  overall: number;
  teamName: string | null;
  teamAbbreviation: string | null;
  branding: TeamBrandingView | null;
  availabilityStatus: string;
}) {
  const name = `${props.firstName} ${props.lastName}`;
  const monogram = initials(props.firstName, props.lastName);
  const teamLabel = props.teamName ?? "Free agent";

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
      {props.branding ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{ backgroundColor: props.branding.primaryColor }}
          aria-hidden="true"
        />
      ) : null}
      <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5">
        {props.branding ? (
          <span
            className="inline-flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700 text-2xl font-semibold text-zinc-50 sm:h-28 sm:w-28 sm:text-3xl"
            style={{ backgroundColor: props.branding.primaryColor }}
            aria-hidden="true"
          >
            {monogram}
          </span>
        ) : (
          <span
            className="inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-amber-700/40 bg-amber-950/50 font-mono text-2xl font-semibold text-amber-400 sm:h-28 sm:w-28 sm:text-3xl"
            aria-hidden="true"
          >
            {monogram}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="text-2xl font-semibold text-zinc-50 sm:text-3xl">
            {name}
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            {props.position} · Age {props.age}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-zinc-300">
            {props.branding ? (
              <span
                className="inline-flex shrink-0 items-center justify-center rounded-sm p-0.5"
                style={{ backgroundColor: props.branding.primaryColor }}
              >
                <TeamLogoMark branding={props.branding} size="sm" decorative />
              </span>
            ) : props.teamAbbreviation ? (
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-amber-700/40 bg-amber-950/50 font-mono text-[10px] font-semibold text-amber-400">
                {props.teamAbbreviation}
              </span>
            ) : null}
            <span>{teamLabel}</span>
          </p>
          <div className="mt-3">
            <InjuryBadge status={props.availabilityStatus} />
          </div>
        </div>

        <div className="shrink-0 self-start rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-2 text-center">
          <p className="text-[10px] uppercase tracking-wide text-amber-500/80">
            Overall
          </p>
          <p className="font-mono text-2xl text-amber-400 sm:text-3xl">
            {props.overall}
          </p>
        </div>
      </div>
    </div>
  );
}
