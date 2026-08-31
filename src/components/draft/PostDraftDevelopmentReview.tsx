import {
  assignToDevelopmentLeagueAction,
} from "@/application/actions";
import type { DraftDlRecommendation } from "@/systems/development-league/recommendations";

export function PostDraftDevelopmentReview(props: {
  saveId: string;
  returnPath: string;
  review: {
    totalDrafted: number;
    strongCandidates: number;
    players: DraftDlRecommendation[];
  };
}) {
  const { review } = props;
  if (review.totalDrafted === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h2 className="text-lg font-semibold text-zinc-100">
        Development Opportunities
      </h2>
      <p className="mt-1 text-sm text-zinc-400">
        You drafted {review.totalDrafted} player
        {review.totalDrafted === 1 ? "" : "s"} this year.{" "}
        {review.strongCandidates}{" "}
        {review.strongCandidates === 1 ? "is a" : "are"} strong Development
        League candidate
        {review.strongCandidates === 1 ? "" : "s"}.
      </p>
      <ul className="mt-4 space-y-3">
        {review.players.map((row) => (
          <li
            key={row.playerId}
            className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-200"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-zinc-500">
                  {row.overall} OVR / {row.potential} POT · Proj.{" "}
                  {Math.round(row.projectedMpg)} MPG
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {row.recommendation === "development_league"
                    ? "Recommended: Development League"
                    : "Keep on top-league roster"}
                </p>
              </div>
              {row.recommendation === "development_league" ? (
                <form action={assignToDevelopmentLeagueAction}>
                  <input type="hidden" name="saveId" value={props.saveId} />
                  <input type="hidden" name="playerId" value={row.playerId} />
                  <input
                    type="hidden"
                    name="returnPath"
                    value={props.returnPath}
                  />
                  <button
                    type="submit"
                    className="rounded border border-amber-600 bg-amber-950/40 px-2 py-1 text-xs text-amber-200"
                  >
                    Assign to DL
                  </button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
