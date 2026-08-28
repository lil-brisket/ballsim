import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { readableTextOnBackground } from "@/domain/color-contrast";
import type { TeamLogoId } from "@/data/team-branding/logo-catalog";

export function TeamIdentityPreview(props: {
  city: string;
  nickname: string;
  abbreviation?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoId: TeamLogoId;
  showUniformPreview?: boolean;
  onSwapHomeAway?: () => void;
}) {
  const textColor = readableTextOnBackground(props.primaryColor);
  const mutedColor =
    textColor === "#FFFFFF" ? "rgba(255,255,255,0.75)" : "rgba(10,10,10,0.7)";
  const showUniforms = props.showUniformPreview !== false;
  const abbreviation =
    props.abbreviation?.trim() ||
    props.city.slice(0, 3).toUpperCase() ||
    "???";

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-xl border border-zinc-700/80 p-6 shadow-lg"
      style={{ backgroundColor: props.primaryColor }}
      data-testid="team-identity-preview"
    >
      <div className="flex w-full items-start justify-between gap-3">
        <TeamLogoMark
          logoId={props.logoId}
          primaryColor={props.primaryColor}
          secondaryColor={props.secondaryColor}
          accentColor={props.accentColor}
          className="h-28 w-28"
          title={`${props.city} ${props.nickname} logo`}
        />
        <div
          className="rounded-md border border-white/25 bg-black/25 px-2.5 py-1.5 text-center"
          aria-label="Scoreboard abbreviation"
        >
          <p
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: mutedColor }}
          >
            Scoreboard
          </p>
          <p
            className="font-mono text-lg font-bold tracking-wider"
            style={{ color: textColor }}
          >
            {abbreviation}
          </p>
        </div>
      </div>
      <div className="text-center">
        <p
          className="font-mono text-xs uppercase tracking-[0.2em]"
          style={{ color: mutedColor }}
        >
          {props.city}
        </p>
        <p
          className="text-3xl font-semibold tracking-tight"
          style={{ color: textColor }}
        >
          {props.nickname || "—"}
        </p>
      </div>
      <div className="flex gap-3" aria-label="Team colours">
        <Swatch label="Primary" color={props.primaryColor} />
        <Swatch label="Secondary" color={props.secondaryColor} />
        <Swatch label="Accent" color={props.accentColor} />
      </div>
      {showUniforms ? (
        <div className="flex w-full max-w-xs flex-col gap-2">
          <div
            className="flex w-full gap-3"
            aria-label="Home and away preview"
          >
            <UniformStrip
              label="Home"
              bodyColor={props.primaryColor}
              trimColor={props.secondaryColor}
              accentColor={props.accentColor}
            />
            <UniformStrip
              label="Away"
              bodyColor={props.secondaryColor}
              trimColor={props.primaryColor}
              accentColor={props.accentColor}
            />
          </div>
          {props.onSwapHomeAway ? (
            <button
              type="button"
              onClick={props.onSwapHomeAway}
              className="self-center rounded-md border border-white/30 bg-black/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white/90 hover:border-amber-400/70 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              Swap Home/Away
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Swatch(props: { label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="h-4 w-8 rounded border border-white/30"
        style={{ backgroundColor: props.color }}
        title={props.label}
      />
      <span className="text-[9px] uppercase tracking-wide text-white/70">
        {props.label}
      </span>
    </div>
  );
}

function UniformStrip(props: {
  label: string;
  bodyColor: string;
  trimColor: string;
  accentColor: string;
}) {
  const numberColor = readableTextOnBackground(props.trimColor);
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <div
        className="relative flex h-16 w-full items-end justify-center rounded-md border border-white/20"
        style={{ backgroundColor: props.bodyColor }}
        data-testid={`${props.label.toLowerCase()}-uniform`}
        data-body-color={props.bodyColor}
      >
        <div
          className="mb-2 flex h-10 w-11 items-center justify-center rounded-sm"
          style={{
            backgroundColor: props.trimColor,
            boxShadow: `inset 0 0 0 2px ${props.accentColor}`,
          }}
        >
          <span
            className="font-mono text-sm font-bold leading-none"
            style={{ color: numberColor }}
            aria-hidden
          >
            23
          </span>
        </div>
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/85">
        {props.label}
      </span>
    </div>
  );
}
