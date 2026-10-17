"use client";

import { Button } from "@/components/ui/Button";
import { useMemo, useState } from "react";
import { confirmTeamIdentityAction } from "@/application/actions";
import {
  TeamColorFields,
  type TeamColorChannel,
} from "@/components/owner/TeamColorFields";
import { TeamIdentityPreview } from "@/components/team/TeamIdentityPreview";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { TeamNicknameField } from "@/components/team/TeamNicknameField";
import {
  findPaletteIdByColors,
  getTeamColorPalette,
  TEAM_COLOR_PALETTES,
  type TeamColorPaletteId,
} from "@/data/team-branding/color-palettes";
import {
  TEAM_LOGO_CATALOG,
  TEAM_LOGO_CATEGORIES,
  type TeamLogoId,
} from "@/data/team-branding/logo-catalog";
import { TEAM_BRANDING_PRESETS } from "@/data/team-branding/branding-presets";
import { normalizeHexColor } from "@/domain/entities/team-branding";
import { evaluateTeamIdentityContrast } from "@/domain/color-contrast";
import { validateTeamNickname } from "@/domain/team-nickname";
import {
  randomizeLogoId,
  randomizeTeamIdentityDraft,
} from "@/systems/owner-franchise-branding";

export function TeamIdentityBuilder(props: {
  saveId: string;
  city: string;
  abbreviation: string;
  initialNickname: string;
  initialPrimaryColor: string;
  initialSecondaryColor: string;
  initialAccentColor: string;
  initialLogoId: TeamLogoId;
  teamId: string;
  existingTeams: readonly { id: string; city: string; name: string }[];
}) {
  const seededIdentity = useMemo(
    () => ({
      nickname: props.initialNickname,
      primaryColor: normalizeHexColor(props.initialPrimaryColor),
      secondaryColor: normalizeHexColor(props.initialSecondaryColor),
      accentColor: normalizeHexColor(props.initialAccentColor),
      logoId: props.initialLogoId,
    }),
    [
      props.initialNickname,
      props.initialPrimaryColor,
      props.initialSecondaryColor,
      props.initialAccentColor,
      props.initialLogoId,
    ],
  );

  const [nickname, setNickname] = useState(seededIdentity.nickname);
  const [primaryColor, setPrimaryColor] = useState(seededIdentity.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(
    seededIdentity.secondaryColor,
  );
  const [accentColor, setAccentColor] = useState(seededIdentity.accentColor);
  const [logoId, setLogoId] = useState<TeamLogoId>(seededIdentity.logoId);
  const [customForced, setCustomForced] = useState(false);

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

  const selectedPaletteId = customForced
    ? null
    : findPaletteIdByColors(primaryColor, secondaryColor, accentColor);

  const contrastWarnings = evaluateTeamIdentityContrast({
    primaryColor,
    secondaryColor,
    accentColor,
  });

  function applyPalette(paletteId: TeamColorPaletteId) {
    const palette = getTeamColorPalette(paletteId);
    setPrimaryColor(normalizeHexColor(palette.primaryColor));
    setSecondaryColor(normalizeHexColor(palette.secondaryColor));
    setAccentColor(normalizeHexColor(palette.accentColor));
    setCustomForced(false);
  }

  function onCommitColor(channel: TeamColorChannel, hex: string) {
    const next = normalizeHexColor(hex);
    if (channel === "primary") {
      setPrimaryColor(next);
    } else if (channel === "secondary") {
      setSecondaryColor(next);
    } else {
      setAccentColor(next);
    }
    setCustomForced(false);
  }

  function onSwapHomeAway() {
    setPrimaryColor(secondaryColor);
    setSecondaryColor(primaryColor);
    setCustomForced(false);
  }

  function onRandomizeIdentity() {
    const next = randomizeTeamIdentityDraft({
      currentNickname: nickname,
      currentPaletteId: selectedPaletteId,
      currentLogoId: logoId,
      usedNicknames,
      city: props.city,
    });
    setNickname(next.nickname);
    setPrimaryColor(normalizeHexColor(next.primaryColor));
    setSecondaryColor(normalizeHexColor(next.secondaryColor));
    setAccentColor(normalizeHexColor(next.accentColor));
    setLogoId(next.logoId);
    setCustomForced(false);
  }

  function onRandomizeLogo() {
    setLogoId(randomizeLogoId(logoId));
  }

  function onResetToGenerated() {
    setNickname(seededIdentity.nickname);
    setPrimaryColor(seededIdentity.primaryColor);
    setSecondaryColor(seededIdentity.secondaryColor);
    setAccentColor(seededIdentity.accentColor);
    setLogoId(seededIdentity.logoId);
    setCustomForced(false);
  }

  const submitDisabled = !nicknameCheck.ok;

  return (
    <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <TeamIdentityPreview
          city={props.city}
          abbreviation={props.abbreviation}
          nickname={nicknameCheck.ok ? nicknameCheck.value : nickname}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          accentColor={accentColor}
          logoId={logoId}
          onSwapHomeAway={onSwapHomeAway}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onRandomizeIdentity}>
            Randomize Identity
          </Button>
          <Button variant="quiet" onClick={onResetToGenerated}>
            Reset to Generated Identity
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-4">
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Presets
          </h2>
          <div className="flex flex-wrap gap-2">
            {TEAM_BRANDING_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant="secondary"
                onClick={() => {
                  applyPalette(preset.paletteId);
                  setLogoId(preset.logoId);
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Colours
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {TEAM_COLOR_PALETTES.map((palette) => {
              const selected = palette.id === selectedPaletteId;
              return (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => applyPalette(palette.id)}
                  aria-pressed={selected}
                  className={`flex items-center gap-2 rounded-md border px-2 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink ${
                    selected
                      ? "border-team-ink bg-team/15"
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
            <button
              type="button"
              onClick={() => setCustomForced(true)}
              aria-pressed={selectedPaletteId === null}
              className={`flex items-center gap-2 rounded-md border px-2 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink ${
                selectedPaletteId === null
                  ? "border-team-ink bg-team/15"
                  : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"
              }`}
            >
              <span className="flex gap-0.5" aria-hidden>
                <span
                  className="h-6 w-4 rounded-sm border border-zinc-600"
                  style={{ backgroundColor: primaryColor }}
                />
                <span
                  className="h-6 w-4 rounded-sm border border-zinc-600"
                  style={{ backgroundColor: secondaryColor }}
                />
                <span
                  className="h-6 w-4 rounded-sm border border-zinc-600"
                  style={{ backgroundColor: accentColor }}
                />
              </span>
              <span className="text-xs font-medium text-zinc-200">Custom</span>
            </button>
          </div>
          <TeamColorFields
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            accentColor={accentColor}
            onCommitColor={onCommitColor}
          />
          {contrastWarnings.length > 0 ? (
            <ul
              className="space-y-1 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-zinc-200"
              role="status"
            >
              {contrastWarnings.map((warning) => (
                <li key={warning.kind}>{warning.message}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Logo
            </h2>
            <Button variant="secondary" onClick={onRandomizeLogo}>
              Randomize Logo
            </Button>
          </div>
          {TEAM_LOGO_CATEGORIES.map((category) => {
            const logos = TEAM_LOGO_CATALOG.filter(
              (logo) => logo.category === category.id,
            );
            return (
              <div key={category.id} className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  {category.label}
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {logos.map((logo) => {
                    const selected = logo.id === logoId;
                    return (
                      <button
                        key={logo.id}
                        type="button"
                        onClick={() => setLogoId(logo.id)}
                        aria-pressed={selected}
                        aria-label={logo.label}
                        title={logo.label}
                        className={`flex flex-col items-center gap-1 rounded-md border p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-team-ink ${
                          selected
                            ? "border-team-ink bg-team/15"
                            : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"
                        }`}
                      >
                        <TeamLogoMark
                          logoId={logo.id}
                          primaryColor={primaryColor}
                          secondaryColor={secondaryColor}
                          accentColor={accentColor}
                          className="h-10 w-10"
                          title={logo.label}
                        />
                        <span className="text-[10px] text-zinc-400">
                          {logo.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        <form action={confirmTeamIdentityAction} className="mt-auto pt-2">
          <input type="hidden" name="saveId" value={props.saveId} />
          <input
            type="hidden"
            name="nickname"
            value={nicknameCheck.ok ? nicknameCheck.value : nickname}
          />
          <input type="hidden" name="logoId" value={logoId} />
          <input type="hidden" name="primaryColor" value={primaryColor} />
          <input type="hidden" name="secondaryColor" value={secondaryColor} />
          <input type="hidden" name="accentColor" value={accentColor} />
          <Button
            type="submit"
            variant="primary"
            disabled={submitDisabled}
            className="w-full"
          >
            Confirm Franchise
          </Button>
        </form>
      </div>
    </div>
  );
}
