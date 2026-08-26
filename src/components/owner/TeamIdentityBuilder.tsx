"use client";

import { useMemo, useState } from "react";
import { confirmTeamIdentityAction } from "@/application/actions";
import { TeamIdentityPreview } from "@/components/team/TeamIdentityPreview";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { TeamNicknameField } from "@/components/team/TeamNicknameField";
import {
  TEAM_COLOR_PALETTES,
  type TeamColorPaletteId,
} from "@/data/team-branding/color-palettes";
import {
  TEAM_LOGO_CATALOG,
  type TeamLogoId,
} from "@/data/team-branding/logo-catalog";
import { brandingFromPalette } from "@/domain/entities/team-branding";
import { validateTeamNickname } from "@/domain/team-nickname";
import { randomizeTeamIdentityDraft } from "@/systems/owner-franchise-branding";

export function TeamIdentityBuilder(props: {
  saveId: string;
  city: string;
  initialNickname: string;
  initialPaletteId: TeamColorPaletteId;
  initialLogoId: TeamLogoId;
  teamId: string;
  existingTeams: readonly { id: string; city: string; name: string }[];
}) {
  const [nickname, setNickname] = useState(props.initialNickname);
  const [paletteId, setPaletteId] = useState<TeamColorPaletteId>(
    props.initialPaletteId,
  );
  const [logoId, setLogoId] = useState<TeamLogoId>(props.initialLogoId);

  const usedNicknames = useMemo(
    () =>
      props.existingTeams
        .filter((team) => team.id !== props.teamId)
        .map((team) => team.name),
    [props.existingTeams, props.teamId],
  );

  const nicknameCheck = validateTeamNickname(nickname, {
    city: props.city,
    existingTeams: props.existingTeams,
    excludeTeamId: props.teamId,
  });

  const branding = brandingFromPalette(paletteId, logoId);

  function onRandomizeIdentity() {
    const next = randomizeTeamIdentityDraft({
      currentNickname: nickname,
      currentPaletteId: paletteId,
      currentLogoId: logoId,
      usedNicknames,
    });
    setNickname(next.nickname);
    setPaletteId(next.paletteId);
    setLogoId(next.logoId);
  }

  const submitDisabled = !nicknameCheck.ok;

  return (
    <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <TeamIdentityPreview
          city={props.city}
          nickname={nicknameCheck.ok ? nicknameCheck.value : nickname}
          primaryColor={branding.primaryColor}
          secondaryColor={branding.secondaryColor}
          accentColor={branding.accentColor}
          logoId={logoId}
        />
        <p className="text-sm text-zinc-400">
          Customize your team&apos;s name, colours, and logo before entering the
          league. Generated values are a starting point — this is your franchise.
        </p>
        <button
          type="button"
          onClick={onRandomizeIdentity}
          className="rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 hover:border-amber-600/60 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          Randomize Identity
        </button>
      </div>

      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-4">
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-500">
            Name
          </h2>
          <p className="text-sm text-zinc-400">
            City: <span className="text-zinc-200">{props.city}</span>
          </p>
          <TeamNicknameField
            id="team-identity-nickname"
            value={nickname}
            onChange={setNickname}
            error={nicknameCheck.ok ? null : nicknameCheck.error}
            helperText="Team name / nickname only — city stays fixed."
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-500">
            Colours
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            {TEAM_COLOR_PALETTES.map((palette) => {
              const selected = palette.id === paletteId;
              return (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => setPaletteId(palette.id)}
                  aria-pressed={selected}
                  className={`flex items-center gap-2 rounded-md border px-2 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                    selected
                      ? "border-amber-500 bg-amber-600/15"
                      : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"
                  }`}
                >
                  <span className="flex gap-0.5" aria-hidden>
                    <span
                      className="h-6 w-4 rounded-sm border border-zinc-600"
                      style={{ backgroundColor: palette.primaryColor }}
                    />
                    <span
                      className="h-6 w-4 rounded-sm border border-zinc-600"
                      style={{ backgroundColor: palette.secondaryColor }}
                    />
                    <span
                      className="h-6 w-4 rounded-sm border border-zinc-600"
                      style={{ backgroundColor: palette.accentColor }}
                    />
                  </span>
                  <span className="text-xs font-medium text-zinc-200">
                    {palette.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-500">
            Logo
          </h2>
          <div className="grid grid-cols-5 gap-2">
            {TEAM_LOGO_CATALOG.map((logo) => {
              const selected = logo.id === logoId;
              const sample = brandingFromPalette(paletteId, logo.id);
              return (
                <button
                  key={logo.id}
                  type="button"
                  onClick={() => setLogoId(logo.id)}
                  aria-pressed={selected}
                  aria-label={logo.label}
                  title={logo.label}
                  className={`flex flex-col items-center gap-1 rounded-md border p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                    selected
                      ? "border-amber-500 bg-amber-600/15"
                      : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"
                  }`}
                >
                  <TeamLogoMark
                    logoId={logo.id}
                    primaryColor={sample.primaryColor}
                    secondaryColor={sample.secondaryColor}
                    accentColor={sample.accentColor}
                    className="h-10 w-10"
                    title={logo.label}
                  />
                  <span className="text-[10px] text-zinc-400">{logo.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <form action={confirmTeamIdentityAction} className="mt-auto pt-2">
          <input type="hidden" name="saveId" value={props.saveId} />
          <input
            type="hidden"
            name="nickname"
            value={nicknameCheck.ok ? nicknameCheck.value : nickname}
          />
          <input type="hidden" name="paletteId" value={paletteId} />
          <input type="hidden" name="logoId" value={logoId} />
          <button
            type="submit"
            disabled={submitDisabled}
            className="w-full rounded-md bg-amber-600 px-3 py-3 text-sm font-semibold text-zinc-950 hover:bg-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            Confirm Franchise
          </button>
        </form>
      </div>
    </div>
  );
}
