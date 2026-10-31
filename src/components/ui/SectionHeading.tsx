import { cn } from "@/components/ui/styles";

const SMALL_TONE = {
  ink: "text-ink",
  soft: "text-soft",
  muted: "text-muted",
  team: "text-team-ink",
  win: "text-win",
  loss: "text-loss",
} as const;

/**
 * Broadcast section heading: condensed uppercase title over a short team-colour
 * underline, with an optional eyebrow and right-aligned action slot.
 *
 * `size="sm"` is the quiet sub-heading for groups inside a card or list
 * (sentence case, no underline, no eyebrow); `tone` colours it.
 *
 * `size="xs"` is a small uppercase label (text-xs, faint) for a caption over
 * a list inside a card; it ignores `tone`.
 *
 * `size="display"` is a display title inside a card or hero (a team or
 * player name): condensed uppercase type only, no underline or eyebrow. The
 * caller sets size, weight, leading and colour through `titleClassName`.
 */
export function SectionHeading(props: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  size?: "xs" | "sm" | "md" | "lg" | "display";
  /** Title colour for `size="sm"`. */
  tone?: keyof typeof SMALL_TONE;
  id?: string;
  /** For headings that receive programmatic focus (e.g. form sections). */
  tabIndex?: number;
  className?: string;
  /** Extra classes on the heading element itself (e.g. `truncate`). */
  titleClassName?: string;
}) {
  const Tag = props.as ?? "h2";
  if (props.size === "display") {
    return (
      <Tag
        id={props.id}
        tabIndex={props.tabIndex}
        className={cn(
          "font-display uppercase tracking-wide",
          props.titleClassName,
          props.className,
        )}
      >
        {props.title}
      </Tag>
    );
  }
  if (props.size === "xs") {
    return (
      <Tag
        id={props.id}
        tabIndex={props.tabIndex}
        className={cn(
          "text-xs font-semibold uppercase tracking-wide text-faint",
          props.titleClassName,
          props.className,
        )}
      >
        {props.title}
      </Tag>
    );
  }
  if (props.size === "sm") {
    const heading = (
      <Tag
        id={props.id}
        tabIndex={props.tabIndex}
        className={cn(
          "text-sm font-semibold",
          SMALL_TONE[props.tone ?? "ink"],
          props.titleClassName,
          !props.action && props.className,
        )}
      >
        {props.title}
      </Tag>
    );
    if (!props.action) return heading;
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2",
          props.className,
        )}
      >
        {heading}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {props.action}
        </div>
      </div>
    );
  }
  const large = props.size === "lg";
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-4 gap-y-2",
        props.className,
      )}
    >
      <div className="min-w-0">
        {props.eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-team-ink">
            {props.eyebrow}
          </p>
        ) : null}
        <Tag
          id={props.id}
          tabIndex={props.tabIndex}
          className={cn(
            "font-display font-bold uppercase leading-tight tracking-wide text-ink",
            large ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl",
            props.titleClassName,
          )}
        >
          {props.title}
        </Tag>
        <span
          aria-hidden
          className={cn(
            "mt-1.5 block h-[3px] rounded-full bg-gradient-to-r from-team-ink to-team",
            large ? "w-16" : "w-10",
          )}
        />
      </div>
      {props.action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {props.action}
        </div>
      ) : null}
    </div>
  );
}
