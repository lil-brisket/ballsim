import { cn } from "@/components/ui/styles";

/**
 * Keycap hint for keyboard shortcuts. Hidden on touch devices, where there is
 * no keyboard to press them on.
 */
export function KeyHint(props: {
  keys: string | string[];
  label?: string;
  className?: string;
}) {
  const keys = Array.isArray(props.keys) ? props.keys : [props.keys];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 pointer-coarse:hidden",
        props.className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        {keys.map((key, index) => (
          <kbd
            key={`${key}-${index}`}
            className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-b-2 border-line-strong bg-surface-high px-1.5 text-xs font-semibold text-soft"
          >
            {key}
          </kbd>
        ))}
      </span>
      {props.label ? (
        <span className="text-sm text-muted">{props.label}</span>
      ) : null}
    </span>
  );
}
