import { SectionHeading } from "@/components/ui/SectionHeading";
import { assignToDevelopmentLeagueAction } from "@/application/actions";
import { buttonClass } from "@/components/ui/Button";
import type { DraftDlRecommendation } from "@/systems/development-league/recommendations";
import { OvrBadge } from "@/components/ui/OvrBadge";

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
    <section className="rounded-xl border border-line bg-surface-raised/50 p-4">
      <SectionHeading title="Development opportunities" />
      <p className="mt-1 text-sm text-muted">
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
            className="rounded-lg border border-line bg-surface-base/40 px-3 py-2 text-sm text-ink"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="flex items-center gap-1.5 text-sm text-faint">
                  <OvrBadge overall={row.overall} size="sm" />
                  <OvrBadge
                    overall={row.potential}
                    ghost
                    label="POT"
                    size="sm"
                  />
                  <span>Proj. {Math.round(row.projectedMpg)} MPG</span>
                </p>
                <p className="mt-1 text-sm text-muted">
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
                    className={buttonClass({ variant: "secondary" })}
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
