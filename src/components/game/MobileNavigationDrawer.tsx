"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import { NavGroups } from "@/components/game/NavGroups";
import { teamThemeStyle } from "@/components/ui/TeamThemeScope";
import {
  cn,
  focusRingClass,
  touchTargetClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import type { TeamThemeColors } from "@/presentation/team-theme";

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
 * shares NavGroups + owner-nav-config data. The drawer portals to <body>,
 * outside the shell's team-colour scope, so it re-applies `branding` itself.
 */
export function MobileNavigationDrawer(props: {
  saveId: string;
  groups?: readonly OwnerNavGroup[];
  /** Compact trigger for the sticky header. Default is a full-width bar. */
  compact?: boolean;
  branding?: TeamThemeColors | null;
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
          <div
            className="fixed inset-0 z-50 flex lg:hidden"
            style={teamThemeStyle(props.branding)}
          >
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
                "drawer-nav-enter relative z-10 flex h-dvh w-[min(20rem,85vw)] flex-col border-r border-surface-line bg-surface-arena shadow-arena",
              )}
            >
              <div className="flex items-center justify-between gap-3 border-b border-surface-line px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <div className="min-w-0">
                  <h2
                    id={titleId}
                    className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-team-ink"
                  >
                    Menu
                  </h2>
                  <Link
                    href="/home"
                    onClick={() => setOpen(false)}
                    className={cn(
                      touchTargetTextClass,
                      "-ml-2 font-display text-xl font-bold uppercase tracking-wider text-zinc-50 hover:text-team-ink",
                      focusRingClass,
                    )}
                  >
                    BallSim
                  </Link>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className={cn(
                    touchTargetClass,
                    "rounded-md border border-surface-line px-2.5 text-sm text-zinc-300 hover:border-team-ink",
                    focusRingClass,
                  )}
                >
                  ✕
                </button>
              </div>
              <nav
                className="min-h-0 flex-1 overflow-y-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
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
          touchTargetClass,
          "rounded-lg border border-surface-line bg-surface-deep/60 px-3 font-display text-base font-bold uppercase tracking-wide text-zinc-200 hover:border-team-ink hover:text-team-ink",
          !props.compact && "w-full",
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
