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
        className="rounded-xl border border-team-ink/40 bg-team/10 px-4 py-3"
      >
        <p className="text-sm font-semibold text-team-ink">Season setup</p>
        <p className="mt-1 text-sm text-ink">
          Simulate to begin the regular season. No games will be played yet.
        </p>
      </div>
    );
  }

  if (props.openingDayPending) {
    return (
      <div
        role="status"
        className="rounded-xl border border-win/40 bg-win/10 px-4 py-3"
      >
        <p className="text-sm font-semibold text-win">Opening Day</p>
        <p className="mt-1 text-sm text-ink">
          The regular season is ready. Simulate again to play today&apos;s
          games.
        </p>
      </div>
    );
  }

  return null;
}
