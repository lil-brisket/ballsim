"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toggleTradeBlockAction } from "@/application/actions";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";

/**
 * Overflow menu for per-player roster actions, so "Add to block" isn't a
 * full button on every row. A plain disclosure: the button toggles a small
 * panel; Escape and outside clicks close it. The action itself is the existing
 * toggleTradeBlockAction form, unchanged.
 */
export function PlayerActionMenu(props: {
  saveId: string;
  playerId: string;
  playerName: string;
  onTradeBlock: boolean;
  returnPath: string;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(
    null,
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  function toggle() {
    if (!open && buttonRef.current) {
      // Fixed position so scroll containers (the table) never clip the menu.
      const rect = buttonRef.current.getBoundingClientRect();
      setAnchor({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((value) => !value);
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }
    function close() {
      setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Actions for ${props.playerName}`}
        onClick={toggle}
        className={cn(
          touchTargetClass,
          "rounded-md border border-surface-line text-lg leading-none text-soft hover:border-team-ink hover:text-team-ink",
          focusRingClass,
        )}
      >
        <span aria-hidden>⋯</span>
      </button>

      {open
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Dismiss actions"
                tabIndex={-1}
                className="fixed inset-0 z-[45] cursor-default"
                onClick={() => setOpen(false)}
              />
              <div
                id={menuId}
                style={anchor ?? undefined}
                className="fixed z-[46] w-44 rounded-lg border border-surface-line bg-surface-arena p-1 shadow-arena"
              >
                <form action={toggleTradeBlockAction}>
                  <input type="hidden" name="saveId" value={props.saveId} />
                  <input type="hidden" name="playerId" value={props.playerId} />
                  <input
                    type="hidden"
                    name="listed"
                    value={props.onTradeBlock ? "false" : "true"}
                  />
                  <input
                    type="hidden"
                    name="returnPath"
                    value={props.returnPath}
                  />
                  <button
                    type="submit"
                    className={cn(
                      touchTargetClass,
                      "w-full justify-start rounded-md px-3 text-sm text-ink hover:bg-white/10",
                      focusRingClass,
                    )}
                  >
                    {props.onTradeBlock ? "Remove block" : "Add to block"}
                  </button>
                </form>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
