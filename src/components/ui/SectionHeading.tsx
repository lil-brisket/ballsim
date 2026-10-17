import { cn } from "@/components/ui/styles";

/**
 * Broadcast section heading: condensed uppercase title over a short team-colour
 * underline, with an optional eyebrow and right-aligned action slot.
 */
export function SectionHeading(props: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  size?: "md" | "lg";
  id?: string;
  className?: string;
}) {
  const Tag = props.as ?? "h2";
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
          className={cn(
            "font-display font-bold uppercase leading-tight tracking-wide text-zinc-50",
            large ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl",
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
