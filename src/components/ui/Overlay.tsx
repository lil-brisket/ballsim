"use client";

import { cn, focusRingClass } from "@/components/ui/styles";

export function Overlay(props: {
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
  /** When true, overlay is invisible but still captures clicks (for drawer patterns). */
  transparent?: boolean;
}) {
  return (
    <div
      role="presentation"
      className={cn(
        "fixed inset-0 z-50",
        props.transparent ? "bg-transparent" : "bg-black/60",
        props.className,
      )}
      onClick={props.onClick}
    >
      {props.children}
    </div>
  );
}

export function OverlayCloseHint(props: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      className={cn(
        "absolute inset-0 cursor-default",
        focusRingClass,
      )}
      onClick={props.onClick}
    />
  );
}
