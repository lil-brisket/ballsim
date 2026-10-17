import { cn, focusRingClass } from "@/components/ui/styles";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-team font-semibold text-on-team hover:brightness-110",
  secondary:
    "border border-zinc-700 bg-zinc-900 font-medium text-zinc-100 hover:border-team-ink",
  quiet: "font-medium text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-50",
  danger:
    "border border-rose-700/60 bg-rose-950/40 font-medium text-rose-200 hover:bg-rose-900/50",
};

const SIZE: Record<ButtonSize, string> = {
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-6 font-display text-lg uppercase tracking-wide",
};

/**
 * Button classes for any element (`<button>`, `<Link>`, `<a>`). Exactly one
 * `primary` per screen region; navigation uses `quiet` or a link.
 */
export function buttonClass(
  options: { variant?: ButtonVariant; size?: ButtonSize } = {},
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md transition touch-manipulation active:opacity-80 disabled:pointer-events-none disabled:opacity-50",
    focusRingClass,
    VARIANT[options.variant ?? "secondary"],
    SIZE[options.size ?? "md"],
  );
}

export function Button(
  props: React.ComponentProps<"button"> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
  },
) {
  const { variant, size, className, type, ...rest } = props;
  return (
    <button
      type={type ?? "button"}
      className={cn(buttonClass({ variant, size }), className)}
      {...rest}
    />
  );
}
