import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { GameResultLink } from "@/components/owner/GameResultLink";
import { StatusBadge } from "@/components/owner/StatusBadge";
import type { ImportanceLevel } from "@/domain/entities/event-source";
import type { MediaStoryType } from "@/domain/entities/media-item";
import { markMediaReadAction } from "@/application/actions";

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
  unread: boolean;
  gameId?: string;
  canOpenGame?: boolean;
  players: MediaStoryCardEntity[];
  teams: MediaStoryCardEntity[];
  returnPath: string;
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
  } = props;

  return (
    <article
      className={`rounded-lg border px-4 py-3 ${
        unread
          ? "border-amber-800/40 bg-amber-950/20"
          : "border-zinc-800 bg-zinc-900/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
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
          <h3 className="text-sm font-medium text-zinc-100">
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
          <p className="text-sm text-zinc-400">{summary}</p>
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

      <p className="mt-2 font-mono text-xs text-zinc-600">{occurredOn}</p>
    </article>
  );
}
