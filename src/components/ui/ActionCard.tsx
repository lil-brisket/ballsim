import Link from "next/link";
import {
  cn,
  densityPadding,
  focusRingClass,
  panelClass,
  touchTargetTextClass,
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
    ({ href: string; onClick?: never } | { href?: never; onClick: () => void }),
) {
  const density = props.density ?? "default";
  const hasSecondary = Boolean(props.secondaryHref && props.secondaryLabel);
  const surfaceClass = cn(
    panelClass,
    "text-left transition-colors hover:border-amber-700/60 hover:bg-zinc-900",
    focusRingClass,
    props.className,
  );

  const main = (
    <>
      {props.badge ? <div className="mb-2">{props.badge}</div> : null}
      <h3 className="text-sm font-medium text-zinc-100">{props.title}</h3>
      {props.description ? (
        <p className="mt-1 text-xs text-zinc-400">{props.description}</p>
      ) : null}
      {props.children}
    </>
  );

  if (props.href && hasSecondary) {
    return (
      <article className={surfaceClass}>
        <Link
          href={props.href}
          className={cn("block", densityPadding[density], focusRingClass)}
        >
          {main}
          {props.footer ? <div className="mt-3">{props.footer}</div> : null}
        </Link>
        <div className="border-t border-zinc-800 px-4 py-1">
          <Link
            href={props.secondaryHref!}
            className={cn(
              touchTargetTextClass,
              "text-xs text-zinc-400 hover:text-zinc-200",
              focusRingClass,
            )}
          >
            {props.secondaryLabel}
          </Link>
        </div>
      </article>
    );
  }

  const paddedClass = cn(surfaceClass, densityPadding[density], "block");
  const footerRow =
    props.footer || hasSecondary ? (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {props.footer}
        {hasSecondary ? (
          <Link
            href={props.secondaryHref!}
            className={cn(
              touchTargetTextClass,
              "text-xs text-zinc-400 hover:text-zinc-200",
              focusRingClass,
            )}
          >
            {props.secondaryLabel}
          </Link>
        ) : null}
      </div>
    ) : null;

  if (props.href) {
    return (
      <Link href={props.href} className={paddedClass}>
        {main}
        {footerRow}
      </Link>
    );
  }

  return (
    <button type="button" onClick={props.onClick} className={paddedClass}>
      {main}
      {footerRow}
    </button>
  );
}
