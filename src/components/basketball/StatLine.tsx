import { cn, type Density } from "@/components/ui/styles";

export type StatLineItem = {
  label: string;
  value: React.ReactNode;
};

/**
 * Compact horizontal stat row — not a bordered card.
 */
export function StatLine(props: {
  items: StatLineItem[];
  density?: Density;
  className?: string;
}) {
  const dense = props.density === "compact";
  return (
    <dl
      className={cn(
        "flex flex-wrap",
        dense ? "gap-x-3 gap-y-1" : "gap-x-4 gap-y-2",
        props.className,
      )}
    >
      {props.items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-sm text-faint">{item.label}</dt>
          <dd className="font-mono text-sm text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
