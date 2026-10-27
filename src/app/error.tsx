"use client";

import { ErrorPanel } from "@/components/ui/ErrorPanel";

/**
 * Error boundary for everything outside a save (splash, saves, new game) and
 * for failures in the save layout itself. No shell here, so the card is
 * centred on the page. `retry` re-fetches and re-renders the segment.
 */
export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <main className="flex flex-1 items-center px-4 py-12 sm:px-6">
      <ErrorPanel
        error={error}
        onRetry={() => retry()}
        backHref="/home"
        backLabel="Back to BallSim home"
      />
    </main>
  );
}
