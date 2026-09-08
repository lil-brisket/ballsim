"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { cn, focusRingClass } from "@/components/ui/styles";

export type DrawerSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<DrawerSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

export function Drawer(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Optional custom header content (replaces default title block when provided). */
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: DrawerSize;
  /** Accessible label override when header slot replaces title text. */
  "aria-label"?: string;
}) {
  const size = props.size ?? "md";
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const mounted = useIsClient();

  const close = useCallback(() => {
    props.onOpenChange(false);
  }, [props]);

  useEffect(() => {
    if (!props.open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      closeRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus();
    };
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [props.open, close]);

  useEffect(() => {
    if (!props.open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
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
  }, [props.open]);

  if (!mounted || !props.open) return null;

  const panel = (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        type="button"
        aria-label="Close drawer"
        className="drawer-backdrop-enter absolute inset-0 bg-black/60"
        onClick={close}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={props.header ? undefined : titleId}
        aria-label={
          props.header ? (props["aria-label"] ?? props.title) : undefined
        }
        aria-describedby={props.description ? descriptionId : undefined}
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full flex-col border-zinc-700 bg-zinc-900 shadow-xl",
          "rounded-t-xl border-t sm:h-full sm:max-h-none sm:rounded-none sm:border-l sm:border-t-0",
          SIZE_CLASS[size],
          "drawer-panel-enter-mobile sm:drawer-panel-enter-desktop",
        )}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-zinc-800 px-4 py-3">
          <div className="min-w-0 flex-1">
            {props.header ? (
              props.header
            ) : (
              <>
                <h2 id={titleId} className="text-lg font-medium text-zinc-50">
                  {props.title}
                </h2>
                {props.description ? (
                  <p
                    id={descriptionId}
                    className="mt-0.5 text-sm text-zinc-400"
                  >
                    {props.description}
                  </p>
                ) : null}
              </>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close"
            className={cn(
              "shrink-0 rounded-md border border-zinc-700 px-2.5 py-1 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100",
              focusRingClass,
            )}
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {props.children}
        </div>

        {props.footer ? (
          <div className="shrink-0 border-t border-zinc-800 px-4 py-3">
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
