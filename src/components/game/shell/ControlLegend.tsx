"use client";

import { useEffect, useId, useRef, useState } from "react";
import { KeyHint } from "@/components/ui/KeyHint";
import { SoundToggle, SoundVolume } from "@/components/ui/sound/SoundControls";
import { cn, focusRingClass } from "@/components/ui/styles";

/** Every global control, for the Controls popover. */
function controls(hubCount: number) {
  return [
    { keys: ["Q", "E"], label: "Previous / next hub" },
    { keys: [`1–${hubCount}`], label: "Jump to a hub" },
    { keys: ["←", "↑", "↓", "→"], label: "Move between tiles and table rows" },
    { keys: ["Tab"], label: "Move to the next control" },
    { keys: ["Enter"], label: "Open or select" },
    { keys: ["Space"], label: "Sim to the next game (nothing focused)" },
    { keys: ["Esc"], label: "Close, or go up a level" },
    { keys: ["/"], label: "Search players, teams and pages" },
    { keys: ["Ctrl", "K"], label: "Search (also Cmd+K)" },
  ];
}

/**
 * Desktop footer listing the main keys, with a Controls popover for the
 * rest. Hidden on touch screens and below lg. Only lists keys that work.
 */
export function ControlLegend(props: { hubCount: number }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    // Capture so the shell's Esc (go up a level) does not also fire.
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <footer
      aria-label="Keyboard controls"
      className="[view-transition-name:shell-legend] fixed inset-x-0 bottom-0 z-30 hidden border-t border-surface-line bg-surface-deep/90 backdrop-blur lg:block pointer-coarse:hidden"
    >
      <div className="relative mx-auto flex max-w-[100rem] flex-wrap items-center gap-x-6 gap-y-1 px-6 py-2">
        <KeyHint keys={["Q", "E"]} label="Hubs" />
        <KeyHint keys={["←", "→"]} label="Move" />
        <KeyHint keys="Enter" label="Select" />
        <KeyHint keys="Space" label="Sim" />
        <KeyHint keys="Esc" label="Back" />
        <KeyHint keys="/" label="Search" />
        <SoundToggle className="ml-auto" />
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "rounded-md px-2 py-1 text-sm text-muted hover:text-ink",
            focusRingClass,
          )}
        >
          Controls
        </button>
        {open ? (
          <div
            ref={panelRef}
            id={panelId}
            className="absolute bottom-full right-6 mb-2 w-80 rounded-xl border border-surface-line bg-surface-raised p-4 shadow-arena"
          >
            <p className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-ink">
              Controls
            </p>
            <ul className="space-y-2">
              {controls(props.hubCount).map((control) => (
                <li
                  key={control.label}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-soft">{control.label}</span>
                  <KeyHint keys={control.keys} />
                </li>
              ))}
            </ul>
            <SoundVolume className="mt-4 border-t border-surface-line pt-3" />
          </div>
        ) : null}
      </div>
    </footer>
  );
}
