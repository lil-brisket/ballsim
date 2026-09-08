"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import { NavGroups } from "@/components/game/NavGroups";
import { cn, focusRingClass } from "@/components/ui/styles";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

/**
 * Mobile navigation overlay drawer. Independent of desktop sidebar UX;
 * shares NavGroups + owner-nav-config data.
 */
export function MobileNavigationDrawer(props: {
  saveId: string;
  groups?: readonly OwnerNavGroup[];
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const mounted = useIsClient();

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const drawer =
    mounted && open
      ? createPortal(
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <button
              type="button"
              aria-label="Close menu"
              className="drawer-backdrop-enter absolute inset-0 bg-black/60"
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className={cn(
                "drawer-nav-enter relative z-10 flex h-full w-[min(20rem,85vw)] flex-col border-r border-zinc-700 bg-zinc-900 shadow-xl",
              )}
            >
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <h2
                  id={titleId}
                  className="text-sm font-medium text-zinc-100"
                >
                  Menu
                </h2>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className={cn(
                    "rounded-md border border-zinc-700 px-2.5 py-1 text-sm text-zinc-300 hover:border-zinc-500",
                    focusRingClass,
                  )}
                >
                  ✕
                </button>
              </div>
              <nav
                className="min-h-0 flex-1 overflow-y-auto p-3"
                aria-label="Owner Mode"
              >
                <NavGroups
                  saveId={props.saveId}
                  groups={props.groups}
                  collapsed={false}
                  onNavigate={() => setOpen(false)}
                />
              </nav>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className={cn(
          "w-full rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-amber-600",
          focusRingClass,
        )}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Menu
      </button>
      {drawer}
    </div>
  );
}
