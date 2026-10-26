import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { cn } from "@/components/ui/styles";
import { readableTextOnBackground } from "@/domain/color-contrast";
import { LeagueMark } from "./LeagueMark";
import type { TimelineAccount } from "@/state/media-timeline/accounts";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";

/** reply 32px, post 40px, large 64px (hero / story viewer). */
export type AccountAvatarSize = "reply" | "post" | "large";

/** Box size for tiles, the league mark and logos. */
const BOX_CLASS: Record<AccountAvatarSize, string> = {
  reply: "h-8 w-8",
  post: "h-10 w-10",
  large: "h-16 w-16",
};
const TILE_TEXT: Record<AccountAvatarSize, string> = {
  reply: "text-xs",
  post: "text-sm",
  large: "text-xl",
};
/** PlayerPortrait sizes with the same pixel boxes. */
const PORTRAIT_SIZE = { reply: "sm", post: "ms", large: "md" } as const;

function initialsOf(text: string): string {
  const words = text.split(/[\s-]+/).filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  return letters || "?";
}

function Tile(props: {
  size: AccountAvatarSize;
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
        BOX_CLASS[props.size],
        TILE_TEXT[props.size],
        !props.background && "bg-surface-high text-ink",
      )}
      style={style}
    >
      {props.initials}
    </span>
  );
}

/** Decorative: the account name is always rendered beside it. */
export function AccountAvatar(props: {
  account: TimelineAccount;
  context: TimelineDisplayContext;
  size: AccountAvatarSize;
}) {
  const { account, context, size } = props;
  const avatar = account.avatar;
  let content;

  if (avatar.type === "league") {
    content = (
      <LeagueMark letters={avatar.letters} className={BOX_CLASS[size]} />
    );
  } else if (avatar.type === "logo") {
    const branding = context.teams[avatar.teamId]?.branding ?? null;
    content = branding ? (
      <TeamLogoMark
        branding={branding}
        className={BOX_CLASS[size]}
        decorative
      />
    ) : (
      <Tile size={size} initials={initialsOf(account.displayName)} />
    );
  } else if (avatar.type === "portrait") {
    const [first = "", ...rest] = account.displayName.split(" ");
    const teamBranding = account.teamId
      ? (context.teams[account.teamId]?.branding ?? null)
      : null;
    content = (
      <PlayerPortrait
        playerId={avatar.playerId}
        firstName={first}
        lastName={rest.join(" ")}
        size={PORTRAIT_SIZE[size]}
        portrait={context.portraits[avatar.playerId] ?? null}
        uniform={
          teamBranding
            ? {
                primaryColor: teamBranding.primaryColor,
                secondaryColor: teamBranding.secondaryColor,
              }
            : null
        }
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
