import Link from "next/link";
import {
  cn,
  densityPadding,
  focusRingClass,
  panelClass,
  type Density,
} from "@/components/ui/styles";

type ActionCardBase = {
  title: string;
  description?: string;
  children?: React.ReactNode;
  density?: Density;
  className?: string;
  /** Optional severity / status badge rendered above the title. */
  badge?: React.ReactNode;
  /** Optional footer content (e.g. deadline, secondary CTA). */
  footer?: React.ReactNode;
  secondaryHref?: string;
  secondaryLabel?: string;
};

/**
 * Actionable entity/object card. Reserved for CTAs — not nested metric boxes.
 */
export function ActionCard(
  props: ActionCardBase &
    (
      | { href: string; onClick?: never }
      | { href?: never; onClick: () => void }
    ),
) {
  const density = props.density ?? "default";
  const className = cn(
    panelClass,
    densityPadding[density],
    "block text-left transition-colors hover:border-amber-700/60 hover:bg-zinc-900",
    focusRingClass,
    props.className,
  );

  const body = (
    <>
      {props.badge ? <div className="mb-2">{props.badge}</div> : null}
      <h3 className="text-sm font-medium text-zinc-100">{props.title}</h3>
      {props.description ? (
        <p className="mt-1 text-xs text-zinc-400">{props.description}</p>
      ) : null}
      {props.children}
      {props.footer || props.secondaryHref ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {props.footer}
          {props.secondaryHref && props.secondaryLabel ? (
            <Link
              href={props.secondaryHref}
              className={cn(
                "text-xs text-zinc-400 hover:text-zinc-200",
                focusRingClass,
              )}
              onClick={(event) => event.stopPropagation()}
            >
              {props.secondaryLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (props.href) {
    return (
      <Link href={props.href} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={props.onClick} className={className}>
      {body}
    </button>
  );
}
