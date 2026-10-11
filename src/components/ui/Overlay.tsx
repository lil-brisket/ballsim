"use client";

import { cn, focusRingClass } from "@/components/ui/styles";

export function Overlay(props: {
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
  /** When true, overlay is invisible but still captures clicks (for drawer patterns). */
  transparent?: boolean;
  /** When false, backdrop is not a close control and ESC is not handled here. */
  dismissible?: boolean;
}) {
  const dismissible = props.dismissible !== false;
  return (
    <div className={cn("fixed inset-0 z-50", props.className)}>
      {dismissible ? (
        <button
          type="button"
          aria-label="Close overlay"
          className={cn(
            "absolute inset-0",
            props.transparent ? "bg-transparent" : "bg-black/60",
          )}
          onClick={props.onClick}
        />
      ) : (
        <div
          className={cn(
            "absolute inset-0",
            props.transparent ? "bg-transparent" : "bg-black/60",
          )}
          aria-hidden="true"
        />
      )}
      {props.children}
    </div>
  );
}

export function OverlayCloseHint(props: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      className={cn("absolute inset-0 cursor-default", focusRingClass)}
      onClick={props.onClick}
    />
  );
}
