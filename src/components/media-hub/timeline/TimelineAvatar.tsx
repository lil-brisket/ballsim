import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { cn } from "@/components/ui/styles";
import { readableTextOnBackground } from "@/domain/color-contrast";
import { LeagueMark } from "./LeagueMark";
import type { TimelineAccount } from "@/state/media-timeline/accounts";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";

export type TimelineAvatarSize = "sm" | "md";

/** Matches PlayerPortrait xs (24px) and sm (32px) so every avatar type lines up. */
const TILE_SIZE: Record<TimelineAvatarSize, string> = {
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-xs",
};

const LOGO_SIZE = { sm: "sm", md: "md" } as const;
/** Same boxes as TeamLogoMark sm and md. */
const LEAGUE_SIZE: Record<TimelineAvatarSize, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
};
const PORTRAIT_SIZE = { sm: "xs", md: "sm" } as const;

function initialsOf(text: string): string {
  const words = text.split(/[\s-]+/).filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  return letters || "?";
}

function Tile(props: {
  size: TimelineAvatarSize;
  initials: string;
  background?: string;
}) {
  const style = props.background
    ? {
        backgroundColor: props.background,
        color: readableTextOnBackground(props.background),
      }
    : undefined;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        TILE_SIZE[props.size],
        !props.background && "bg-zinc-800 text-zinc-100",
      )}
      style={style}
    >
      {props.initials}
    </span>
  );
}

/** Decorative: the account name is always rendered beside it. */
export function TimelineAvatar(props: {
  account: TimelineAccount;
  context: TimelineDisplayContext;
  size: TimelineAvatarSize;
}) {
  const { account, context, size } = props;
  const avatar = account.avatar;
  let content;

  if (avatar.type === "league") {
    content = (
      <LeagueMark letters={avatar.letters} className={LEAGUE_SIZE[size]} />
    );
  } else if (avatar.type === "logo") {
    const branding = context.teams[avatar.teamId]?.branding ?? null;
    content = branding ? (
      <TeamLogoMark branding={branding} size={LOGO_SIZE[size]} decorative />
    ) : (
      <Tile size={size} initials={initialsOf(account.displayName)} />
    );
  } else if (avatar.type === "portrait") {
    const [first = "", ...rest] = account.displayName.split(" ");
    content = (
      <PlayerPortrait
        playerId={avatar.playerId}
        firstName={first}
        lastName={rest.join(" ")}
        size={PORTRAIT_SIZE[size]}
        portrait={context.portraits[avatar.playerId] ?? null}
      />
    );
  } else {
    const background = avatar.teamId
      ? context.teams[avatar.teamId]?.branding?.primaryColor
      : undefined;
    content = (
      <Tile size={size} initials={avatar.initials} background={background} />
    );
  }

  return (
    <span aria-hidden="true" className="inline-flex shrink-0">
      {content}
    </span>
  );
}
