import { cn, panelClass } from "@/components/ui/styles";

export type ProfileStatTileItem = {
  label: string;
  value: React.ReactNode;
};

function displayValue(value: React.ReactNode): React.ReactNode {
  if (value == null) {
    return "—";
  }
  return value;
}

export function ProfileStatTiles(props: {
  items: ProfileStatTileItem[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5",
        props.className,
      )}
    >
      {props.items.map((item) => (
        <div key={item.label} className={cn(panelClass, "min-w-0 px-3 py-3")}>
          <dt className="text-sm text-muted">{item.label}</dt>
          <dd className="mt-1 font-mono text-xl text-ink">
            {displayValue(item.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
