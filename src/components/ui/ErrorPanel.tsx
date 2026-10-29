"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { buttonClass } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/components/ui/styles";

/** Digest string of a thrown value, if the framework attached one. */
export function errorDigest(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "digest" in error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === "string" && digest !== "") return digest;
  }
  return undefined;
}

function devMessage(error: unknown): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  if (error instanceof Error && error.message) return error.message;
  return undefined;
}

/**
 * Console-style error card for the `error.tsx` boundaries. The heading takes
 * focus on mount so keyboard and screen-reader users land on it. The thrown
 * message is shown in development only; production shows the digest.
 */
export function ErrorPanel(props: {
  error: unknown;
  onRetry: () => void;
  backHref: string;
  backLabel: string;
  className?: string;
}) {
  const headingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    headingRef.current?.querySelector<HTMLElement>("h2")?.focus();
  }, []);
  useEffect(() => {
    console.error(props.error);
  }, [props.error]);
  const digest = errorDigest(props.error);
  const message = devMessage(props.error);
  return (
    <ArenaPanel
      edge="left"
      density="comfortable"
      className={cn("mx-auto w-full max-w-2xl", props.className)}
    >
      <div className="space-y-4">
        <div ref={headingRef}>
          <SectionHeading
            title="Something went wrong"
            tabIndex={-1}
            titleClassName="focus:outline-none"
          />
        </div>
        <p role="alert" className="text-sm text-soft">
          This page hit an unexpected problem. Your save is safe; try again, or
          head back.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={props.onRetry}
            className={buttonClass({ variant: "primary" })}
          >
            Try again
          </button>
          <Link
            href={props.backHref}
            className={buttonClass({ variant: "quiet" })}
          >
            {props.backLabel}
          </Link>
        </div>
        {digest ? (
          <p className="text-sm text-faint">Error reference: {digest}</p>
        ) : null}
        {message ? (
          <p className="break-words text-sm text-faint">
            Development only: {message}
          </p>
        ) : null}
      </div>
    </ArenaPanel>
  );
}
