import { cn, type Density } from "@/components/ui/styles";

/**
 * Inline label + value. Not a bordered card — use inside sections/panels.
 */
export function Metric(props: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  density?: Density;
  className?: string;
}) {
  const dense = props.density === "compact";
  return (
    <div className={cn(props.className)}>
      <p
        className={cn(
          "font-mono uppercase tracking-[0.16em] text-zinc-500",
          dense ? "text-[0.6rem]" : "text-[0.65rem]",
        )}
      >
        {props.label}
      </p>
      <div
        className={cn(
          "mt-0.5 text-zinc-50",
          dense ? "text-sm" : "text-base",
          props.mono && "font-mono",
        )}
      >
        {props.value}
      </div>
    </div>
  );
}
