"use client";

import { useEffect, useState } from "react";
import {
  isHexColor,
  normalizeHexColor,
} from "@/domain/entities/team-branding";

export type TeamColorChannel = "primary" | "secondary" | "accent";

const CHANNEL_LABELS: Record<TeamColorChannel, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
};

export function TeamColorFields(props: {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  onCommitColor: (channel: TeamColorChannel, hex: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <ColorChannelField
        channel="primary"
        label={CHANNEL_LABELS.primary}
        committedColor={props.primaryColor}
        onCommit={(hex) => props.onCommitColor("primary", hex)}
      />
      <ColorChannelField
        channel="secondary"
        label={CHANNEL_LABELS.secondary}
        committedColor={props.secondaryColor}
        onCommit={(hex) => props.onCommitColor("secondary", hex)}
      />
      <ColorChannelField
        channel="accent"
        label={CHANNEL_LABELS.accent}
        committedColor={props.accentColor}
        onCommit={(hex) => props.onCommitColor("accent", hex)}
      />
    </div>
  );
}

function ColorChannelField(props: {
  channel: TeamColorChannel;
  label: string;
  committedColor: string;
  onCommit: (hex: string) => void;
}) {
  const [draftHex, setDraftHex] = useState(props.committedColor);

  useEffect(() => {
    setDraftHex(props.committedColor);
  }, [props.committedColor]);

  function commitDraft(raw: string) {
    const normalized = normalizeHexColor(raw);
    if (!isHexColor(normalized)) {
      setDraftHex(props.committedColor);
      return;
    }
    setDraftHex(normalized);
    if (normalized !== props.committedColor) {
      props.onCommit(normalized);
    }
  }

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={`team-color-${props.channel}-hex`}
        className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400"
      >
        {props.label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`team-color-${props.channel}-picker`}
          type="color"
          value={props.committedColor.toLowerCase()}
          aria-label={`${props.label} colour picker`}
          onChange={(event) => {
            const next = normalizeHexColor(event.target.value);
            setDraftHex(next);
            props.onCommit(next);
          }}
          className="h-9 w-10 cursor-pointer rounded border border-zinc-600 bg-zinc-950 p-0.5"
        />
        <input
          id={`team-color-${props.channel}-hex`}
          type="text"
          value={draftHex}
          spellCheck={false}
          autoComplete="off"
          aria-label={`${props.label} HEX`}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraftHex(event.target.value)}
          onBlur={() => commitDraft(draftHex)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft(draftHex);
              event.currentTarget.blur();
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs uppercase text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        />
      </div>
    </div>
  );
}
