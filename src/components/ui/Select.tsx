import { cn, focusRingClass } from "@/components/ui/styles";

/**
 * Styled native `<select>`: keeps native keyboard, screen-reader and form
 * behaviour (`name`, `value`, `defaultValue`, server-action posts) with a
 * BallSim trigger and chevron. Pass `<option>` children as usual.
 */
export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    /** Classes for the wrapper (width, margin). */
    wrapperClassName?: string;
  },
) {
  const { className, wrapperClassName, ...rest } = props;
  return (
    <span className={cn("relative inline-flex", wrapperClassName)}>
      <select
        className={cn(
          "min-h-11 w-full appearance-none rounded-md border border-zinc-700 bg-zinc-900 py-2 pl-3 pr-9 text-sm text-zinc-100 transition hover:border-zinc-500 disabled:opacity-50",
          focusRingClass,
          className,
        )}
        {...rest}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m4 6 4 4 4-4" />
      </svg>
    </span>
  );
}
