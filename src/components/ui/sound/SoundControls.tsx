"use client";

import { useId } from "react";
import { cn, focusRingClass } from "@/components/ui/styles";
import { useSoundSettings } from "@/components/ui/sound/sound-settings";
import { playUiSound } from "@/components/ui/sound/ui-sound";

/** "Sound: Off/On" toggle. Turning it on plays a confirmation click. */
export function SoundToggle(props: { className?: string }) {
  const { enabled, setEnabled } = useSoundSettings();
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={() => {
        setEnabled(!enabled);
        // A user click, so audio is allowed; confirms sound is on.
        if (!enabled) playUiSound("select");
      }}
      className={cn(
        "inline-flex min-h-11 items-center rounded-md px-2 text-sm text-muted touch-manipulation hover:text-ink",
        enabled && "text-team-ink",
        focusRingClass,
        props.className,
      )}
    >
      Sound: {enabled ? "On" : "Off"}
    </button>
  );
}

/** Volume slider for the viewer; disabled while sound is off. */
export function SoundVolume(props: { className?: string }) {
  const { enabled, volume, setVolume } = useSoundSettings();
  const id = useId();
  return (
    <div className={cn("flex items-center gap-3", props.className)}>
      <label htmlFor={id} className="text-sm text-soft">
        Sound volume
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(volume * 100)}
        disabled={!enabled}
        onChange={(event) => setVolume(Number(event.target.value) / 100)}
        className={cn(
          "min-w-0 flex-1 accent-team-ink disabled:cursor-not-allowed disabled:opacity-50",
          focusRingClass,
        )}
      />
    </div>
  );
}
