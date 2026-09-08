import {
  cn,
  densityPadding,
  panelClass,
  type Density,
} from "@/components/ui/styles";

/**
 * Metric surface for page-level stats. Do not nest StatCards inside Panel.
 */
export function StatCard(props: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  density?: Density;
  className?: string;
}) {
  const density = props.density ?? "comfortable";
  return (
    <div
      className={cn(panelClass, densityPadding[density], props.className)}
    >
      <h2 className="text-sm font-medium text-zinc-400">{props.label}</h2>
      <div
        className={cn(
          "mt-2 text-xl text-zinc-50",
          props.mono && "font-mono",
        )}
      >
        {props.value}
      </div>
    </div>
  );
}
