/**
 * Explains the two-advance opener contract while schedule exists but competition
 * has not started (or opener games have not been played yet).
 */
export function SeasonLifecycleBanner(props: {
  seasonInitializationRequired: boolean;
  openingDayPending: boolean;
}) {
  if (props.seasonInitializationRequired) {
    return (
      <div
        role="status"
        className="rounded-xl border border-sky-800/50 bg-sky-950/30 px-4 py-3"
      >
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-sky-400">
          Season setup
        </p>
        <p className="mt-1 text-sm text-sky-50">
          Simulate to begin the regular season. No games will be played yet.
        </p>
      </div>
    );
  }

  if (props.openingDayPending) {
    return (
      <div
        role="status"
        className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3"
      >
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-emerald-400">
          Opening Day
        </p>
        <p className="mt-1 text-sm text-emerald-50">
          The regular season is ready. Simulate again to play today&apos;s games.
        </p>
      </div>
    );
  }

  return null;
}
