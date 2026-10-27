"use client";

import { usePathname } from "next/navigation";
import { backTarget } from "@/components/game/save-error-target";
import { ErrorPanel } from "@/components/ui/ErrorPanel";

/**
 * Error boundary for every page in a save. It sits under the save layout, so
 * the header and sub-tabs stay usable. `retry` (Next 16.3) re-fetches and
 * re-renders the segment.
 */
export default function DashboardError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const target = backTarget(usePathname() ?? "");
  return (
    <ErrorPanel
      error={error}
      onRetry={() => retry()}
      backHref={target.href}
      backLabel={target.label}
    />
  );
}
