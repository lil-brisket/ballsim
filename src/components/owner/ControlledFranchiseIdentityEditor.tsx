"use client";

import {
  TeamColorFields,
  type TeamColorChannel,
} from "@/components/owner/TeamColorFields";
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
import { normalizeHexColor } from "@/domain/entities/team-branding";

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500";

export type ControlledFranchiseIdentityDraft = {
  teamId: string;
  city: string;
  abbreviation: string;
  nickname: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoId: TeamLogoId;
};

export function ControlledFranchiseIdentityEditor(props: {
  draft: ControlledFranchiseIdentityDraft;
  nicknameError: string | null;
  onChange: (next: ControlledFranchiseIdentityDraft) => void;
}) {
  const { draft, nicknameError, onChange } = props;
  const selectedPaletteId = findPaletteIdByColors(
    draft.primaryColor,
    draft.secondaryColor,
    draft.accentColor,
  );

  function applyPalette(paletteId: TeamColorPaletteId) {
    const palette = getTeamColorPalette(paletteId);
    onChange({
      ...draft,
      primaryColor: normalizeHexColor(palette.primaryColor),
      secondaryColor: normalizeHexColor(palette.secondaryColor),
      accentColor: normalizeHexColor(palette.accentColor),
    });
  }

  function onCommitColor(channel: TeamColorChannel, hex: string) {
    const next = normalizeHexColor(hex);
    if (channel === "primary") {
      onChange({ ...draft, primaryColor: next });
    } else if (channel === "secondary") {
      onChange({ ...draft, secondaryColor: next });
    } else {
      onChange({ ...draft, accentColor: next });
    }
  }

  return (
    <div className="space-y-4 border-t border-zinc-800 pt-3">
      <section
        aria-label="Identity preview"
        data-testid="identity-preview"
        className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3"
      >
        <span
          className="inline-flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-700"
          style={{ backgroundColor: draft.primaryColor }}
        >
          <TeamLogoMark
            branding={{
              primaryColor: draft.primaryColor,
              secondaryColor: draft.secondaryColor,
              accentColor: draft.accentColor,
              logoId: draft.logoId,
            }}
            size="lg"
            className="h-16 w-16"
            title={`${draft.city} ${draft.nickname}`}
          />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              data-testid="identity-preview-title"
              className="text-base font-semibold text-zinc-100"
            >
              {draft.city} {draft.nickname}
            </h3>
            <span
              data-testid="identity-preview-abbreviation"
              className="rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-zinc-200"
            >
              {draft.abbreviation}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Abbreviation is set from your city.
          </p>
          <ul className="flex flex-wrap gap-3" aria-label="Team colours">
            {(
              [
                ["Primary", draft.primaryColor],
                ["Secondary", draft.secondaryColor],
                ["Accent", draft.accentColor],
              ] as const
            ).map(([label, hex]) => (
              <li
                key={label}
                className="flex items-center gap-1.5 text-xs text-zinc-300"
              >
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-sm border border-zinc-600"
                  style={{ backgroundColor: hex }}
                />
                <span>{label}</span>
                <span
                  data-testid={`identity-preview-${label.toLowerCase()}-hex`}
                  className="font-mono text-zinc-400"
                >
                  {hex}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <TeamNicknameField
        id={`controlled-nickname-${draft.teamId}`}
        value={draft.nickname}
        onChange={(nickname) => onChange({ ...draft, nickname })}
        error={nicknameError}
        helperText="Nickname only — city stays fixed."
      />

      <fieldset className="space-y-2">
        <legend className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          Colour palettes
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TEAM_COLOR_PALETTES.map((palette) => {
            const selected = palette.id === selectedPaletteId;
            return (
              <button
                key={palette.id}
                type="button"
                aria-pressed={selected}
                onClick={() => applyPalette(palette.id)}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs ${focusRing} ${
                  selected
                    ? "border-amber-500 bg-amber-500/10 text-amber-200"
                    : "border-zinc-700 text-zinc-300 hover:border-amber-600/60"
                }`}
              >
                <span className="flex gap-0.5">
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: palette.primaryColor }}
                  />
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: palette.secondaryColor }}
                  />
                  <span
                    className="h-3 w-3 rounded-sm"
                    style={{ backgroundColor: palette.accentColor }}
                  />
                </span>
                {palette.label}
                {selected ? (
                  <span aria-hidden="true" className="ml-auto font-bold">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <TeamColorFields
          primaryColor={draft.primaryColor}
          secondaryColor={draft.secondaryColor}
          accentColor={draft.accentColor}
          onCommitColor={onCommitColor}
        />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          Logo
        </legend>
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-zinc-800 p-2">
          {TEAM_LOGO_CATEGORIES.map((category) => {
            const logos = TEAM_LOGO_CATALOG.filter(
              (logo) => logo.category === category.id,
            );
            if (logos.length === 0) {
              return null;
            }
            return (
              <div key={category.id} className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                  {category.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {logos.map((logo) => {
                    const selected = logo.id === draft.logoId;
                    return (
                      <button
                        key={logo.id}
                        type="button"
                        title={logo.label}
                        aria-label={logo.label}
                        aria-pressed={selected}
                        onClick={() => onChange({ ...draft, logoId: logo.id })}
                        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-md border ${focusRing} ${
                          selected
                            ? "border-2 border-amber-500 bg-amber-500/15 ring-1 ring-amber-500"
                            : "border-zinc-700 hover:border-amber-600/60"
                        }`}
                        style={{ backgroundColor: draft.primaryColor }}
                      >
                        <TeamLogoMark
                          branding={{
                            primaryColor: draft.primaryColor,
                            secondaryColor: draft.secondaryColor,
                            accentColor: draft.accentColor,
                            logoId: logo.id,
                          }}
                          size="sm"
                          title={logo.label}
                        />
                        {selected ? (
                          <span
                            aria-hidden="true"
                            className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-zinc-950"
                          >
                            ✓
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
