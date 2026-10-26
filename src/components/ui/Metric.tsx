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
      <p className="text-sm text-muted">{props.label}</p>
      <div
        className={cn(
          "mt-0.5 text-ink",
          dense ? "text-sm" : "text-base",
          props.mono && "font-mono",
        )}
      >
        {props.value}
      </div>
    </div>
  );
}
