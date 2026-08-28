"use client";

import { TeamColorFields, type TeamColorChannel } from "@/components/owner/TeamColorFields";
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
      <div className="flex items-start gap-3">
        <span
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-700"
          style={{ backgroundColor: draft.primaryColor }}
        >
          <TeamLogoMark
            branding={{
              primaryColor: draft.primaryColor,
              secondaryColor: draft.secondaryColor,
              accentColor: draft.accentColor,
              logoId: draft.logoId,
            }}
            size="md"
            title={`${draft.city} ${draft.nickname}`}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-zinc-400">
            City: <span className="text-zinc-200">{draft.city}</span>
          </p>
          <TeamNicknameField
            id={`controlled-nickname-${draft.teamId}`}
            value={draft.nickname}
            onChange={(nickname) => onChange({ ...draft, nickname })}
            error={nicknameError}
            helperText="Nickname only — city stays fixed."
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          Colour palettes
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TEAM_COLOR_PALETTES.map((palette) => {
            const selected = palette.id === selectedPaletteId;
            return (
              <button
                key={palette.id}
                type="button"
                onClick={() => applyPalette(palette.id)}
                className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs ${
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
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          Logo
        </p>
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
                        onClick={() =>
                          onChange({ ...draft, logoId: logo.id })
                        }
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-md border ${
                          selected
                            ? "border-amber-500 bg-amber-500/15"
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
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
