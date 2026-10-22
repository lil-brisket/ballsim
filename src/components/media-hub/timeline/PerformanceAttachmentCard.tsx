import Link from "next/link";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { TeamThemeScope } from "@/components/ui/TeamThemeScope";
import { cn, focusRingClass, linkClass } from "@/components/ui/styles";
import {
  playerHref,
  type TimelineDisplayContext,
} from "@/state/media-timeline/post-view";
import type {
  PerformanceAttachment,
  PerformanceReason,
} from "@/state/media-timeline/types";
import { attachmentSurfaceClass } from "./attachment-parts";

function reasonLabel(
  reason: PerformanceReason,
  line: PerformanceAttachment["line"],
): string {
  switch (reason) {
    case "forty_points":
      return `${line.points}-point night`;
    case "twenty_twenty":
      return "20-20 game";
    case "triple_double":
      return "Triple-double";
    case "blocks":
      return `${line.blocks} blocks`;
    case "steals":
      return `${line.steals} steals`;
    case "assists":
      return `${line.assists} assists`;
    case "season_high":
      return "Season high";
  }
}

function BigStat(props: { label: string; value: number }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-sm text-zinc-400">{props.label}</dt>
      <dd className="font-display text-3xl font-extrabold tabular-nums text-zinc-50">
        {props.value}
      </dd>
    </div>
  );
}

function SmallStat(props: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="text-sm text-zinc-400">{props.label}</dt>
      <dd className="text-sm font-medium tabular-nums text-zinc-200">
        {props.value}
      </dd>
    </div>
  );
}

/** Player performance attachment: portrait, identity and a lower-third stat strip. */
export function PerformanceAttachmentCard(props: {
  attachment: PerformanceAttachment;
  context: TimelineDisplayContext;
}) {
  const { attachment: a, context } = props;
  const { player, line } = a;
  const branding = context.teams[a.team.teamId]?.branding ?? null;
  const notable = a.reasons.map((r) => reasonLabel(r, line)).join(" · ");

  return (
    <TeamThemeScope
      branding={branding}
      className={cn(attachmentSurfaceClass, "space-y-3")}
    >
      <div className="flex items-center gap-3">
        <PlayerPortrait
          playerId={player.playerId}
          firstName={player.firstName}
          lastName={player.lastName}
          size="md"
          portrait={context.portraits[player.playerId]}
        />
        <div className="min-w-0 text-sm">
          <Link
            href={playerHref(context.saveId, player.playerId)}
            className={cn(
              "block truncate font-display text-lg font-bold",
              linkClass,
              focusRingClass,
            )}
          >
            {player.firstName} {player.lastName}
          </Link>
          <p className="text-zinc-400">
            {a.team.abbreviation} vs {a.opponent.abbreviation} ·{" "}
            <span
              className={cn("font-medium", a.won ? "text-win" : "text-loss")}
            >
              {a.won ? "W" : "L"}
            </span>
          </p>
        </div>
      </div>

      <div className="space-y-2 border-t-2 border-team pt-3">
        <dl className="grid grid-cols-3 gap-3">
          <BigStat label="PTS" value={line.points} />
          <BigStat label="REB" value={line.rebounds} />
          <BigStat label="AST" value={line.assists} />
        </dl>
        <dl className="flex flex-wrap gap-x-4 gap-y-1">
          <SmallStat label="STL" value={line.steals} />
          <SmallStat label="BLK" value={line.blocks} />
          <SmallStat
            label="FG"
            value={`${line.fieldGoalsMade}–${line.fieldGoalsAttempted}`}
          />
          <SmallStat
            label="3P"
            value={`${line.threePointersMade}–${line.threePointersAttempted}`}
          />
          <SmallStat label="MIN" value={Math.round(line.minutes)} />
        </dl>
      </div>

      {notable ? <p className="text-sm text-zinc-300">{notable}</p> : null}
    </TeamThemeScope>
  );
}
