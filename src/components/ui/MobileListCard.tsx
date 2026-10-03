import { cn, panelClass } from "@/components/ui/styles";

/**
 * Compact tappable card for list UIs that use DataTable on md+.
 */
export function MobileListCard(props: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        panelClass,
        "flex flex-col gap-2 p-3",
        props.className,
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-zinc-100">{props.title}</div>
        {props.subtitle ? (
          <div className="mt-0.5 text-xs text-zinc-400">{props.subtitle}</div>
        ) : null}
      </div>
      {props.meta ? (
        <div className="text-sm text-zinc-300">{props.meta}</div>
      ) : null}
      {props.action ? <div className="mt-1">{props.action}</div> : null}
    </article>
  );
}
