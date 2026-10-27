"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  acquireDrawerScrollLock,
  releaseDrawerScrollLock,
} from "@/components/ui/drawer-scroll-lock";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";

export type DrawerSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<DrawerSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-5xl",
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
  /** Scrollable body node — used to reset scroll without remounting. */
  onBodyElement?: (element: HTMLDivElement | null) => void;
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
  const { onBodyElement } = props;

  const close = useCallback(() => {
    props.onOpenChange(false);
  }, [props]);

  useEffect(() => {
    if (!props.open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    acquireDrawerScrollLock();

    const focusTimer = window.setTimeout(() => {
      closeRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      releaseDrawerScrollLock();
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
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );
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
    <div
      data-drawer-placement="modal"
      className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-6"
    >
      <button
        type="button"
        aria-label="Close drawer"
        className="drawer-backdrop-enter absolute inset-0 bg-black/60 backdrop-blur-sm"
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
        data-drawer-placement="modal"
        className={cn(
          "relative z-10 flex w-full flex-col border-line-strong bg-surface-raised shadow-xl",
          "h-[100dvh] max-h-[100dvh] rounded-none border-0 sm:h-auto sm:max-h-[min(90dvh,52rem)] sm:rounded-xl sm:border",
          SIZE_CLASS[size],
          "drawer-panel-enter-modal",
        )}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-line px-4 py-3 sm:pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0 flex-1">
            {props.header ? (
              props.header
            ) : (
              <>
                <h2 id={titleId} className="text-lg font-medium text-ink">
                  {props.title}
                </h2>
                {props.description ? (
                  <p id={descriptionId} className="mt-0.5 text-sm text-muted">
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
              touchTargetClass,
              "shrink-0 rounded-md border border-line-strong px-2.5 text-sm text-soft hover:border-faint hover:text-ink",
              focusRingClass,
            )}
          >
            ✕
          </button>
        </div>

        <div
          ref={onBodyElement}
          data-drawer-body=""
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        >
          {props.children}
        </div>

        {props.footer ? (
          <div className="safe-area-bottom shrink-0 border-t border-line px-4 py-3">
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
