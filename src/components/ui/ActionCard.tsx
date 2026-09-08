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
      <h3 className="text-sm font-medium text-zinc-100">{props.title}</h3>
      {props.description ? (
        <p className="mt-1 text-xs text-zinc-400">{props.description}</p>
      ) : null}
      {props.children}
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
