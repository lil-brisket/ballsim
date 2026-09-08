import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { GameResultLink } from "@/components/owner/GameResultLink";
import { StatusBadge } from "@/components/owner/StatusBadge";
import type { ImportanceLevel } from "@/domain/entities/event-source";
import type { MediaStoryType } from "@/domain/entities/media-item";
import { markMediaReadAction } from "@/application/actions";
import {
  mediaPresentationTier,
  type MediaPresentationTier,
} from "@/components/media-hub/media-importance-tiers";
import { cn } from "@/components/ui/styles";

export type MediaStoryCardEntity = {
  id: string;
  name: string;
  canOpen?: boolean;
  href?: string;
  abbreviation?: string;
};

export type MediaStoryCardProps = {
  saveId: string;
  id: string;
  headline: string;
  summary: string;
  occurredOn: string;
  storyType: MediaStoryType;
  importance: ImportanceLevel;
  relevanceScore?: number;
  unread: boolean;
  gameId?: string;
  canOpenGame?: boolean;
  players: MediaStoryCardEntity[];
  teams: MediaStoryCardEntity[];
  returnPath: string;
  featured?: boolean;
  reactionCount?: number;
};

function importanceTone(level: ImportanceLevel): string {
  switch (level) {
    case "critical":
      return "critical";
    case "high":
      return "warning";
    case "medium":
      return "info";
    case "low":
      return "neutral";
  }
}

function tierClasses(
  tier: MediaPresentationTier,
  unread: boolean,
  featured: boolean,
): string {
  if (featured) {
    return cn(
      "border-amber-700/50 bg-gradient-to-b from-amber-950/30 to-zinc-900/40 px-5 py-5",
      unread && "ring-1 ring-amber-600/30",
    );
  }
  if (tier === "major") {
    return cn(
      "border-zinc-700 bg-zinc-900/50 px-4 py-4",
      unread && "border-amber-800/40 bg-amber-950/15",
    );
  }
  if (tier === "background") {
    return cn(
      "border-zinc-800/60 bg-transparent px-3 py-2",
      unread && "border-amber-900/30",
    );
  }
  return cn(
    "border-zinc-800 bg-zinc-900/40 px-4 py-3",
    unread && "border-amber-800/40 bg-amber-950/20",
  );
}

export function MediaStoryCard(props: MediaStoryCardProps) {
  const {
    saveId,
    id,
    headline,
    summary,
    occurredOn,
    storyType,
    importance,
    unread,
    gameId,
    canOpenGame = false,
    players,
    teams,
    returnPath,
    featured = false,
    reactionCount,
  } = props;

  const tier = mediaPresentationTier(importance);

  return (
    <article
      className={cn("rounded-lg border", tierClasses(tier, unread, featured))}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {featured ? (
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-amber-500">
                Featured
              </span>
            ) : null}
            <StatusBadge label={importance} tone={importanceTone(importance)} />
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">
              {storyType}
            </span>
            {unread ? (
              <span className="text-[11px] font-medium text-amber-400">
                Unread
              </span>
            ) : null}
          </div>
          <h3
            className={cn(
              "font-medium text-zinc-100",
              featured || tier === "major" ? "text-lg" : "text-sm",
            )}
          >
            {gameId ? (
              <GameResultLink
                saveId={saveId}
                gameId={gameId}
                canOpen={canOpenGame}
                className="hover:text-amber-400"
              >
                {headline}
              </GameResultLink>
            ) : (
              headline
            )}
          </h3>
          <p
            className={cn(
              "text-zinc-400",
              featured ? "text-sm leading-relaxed" : "text-sm",
              tier === "background" && "line-clamp-2 text-xs",
            )}
          >
            {summary}
          </p>
        </div>
        {unread ? (
          <form action={markMediaReadAction} className="shrink-0">
            <input type="hidden" name="saveId" value={saveId} />
            <input type="hidden" name="mediaItemId" value={id} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <button
              type="submit"
              className="text-xs text-amber-400 hover:underline"
            >
              Mark read
            </button>
          </form>
        ) : null}
      </div>

      {(teams.length > 0 || players.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
          {teams.map((team) => (
            <TeamEntityLink
              key={team.id}
              saveId={saveId}
              teamId={team.id}
              href={team.href}
            >
              {team.abbreviation ?? team.name}
            </TeamEntityLink>
          ))}
          {players.map((player) => (
            <PlayerEntityLink
              key={player.id}
              saveId={saveId}
              playerId={player.id}
              canOpen={player.canOpen !== false}
            >
              {player.name}
            </PlayerEntityLink>
          ))}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-xs text-zinc-600">
        <span>{occurredOn}</span>
        {reactionCount != null && reactionCount > 0 ? (
          <span>{reactionCount} reaction{reactionCount === 1 ? "" : "s"}</span>
        ) : null}
      </div>
    </article>
  );
}
