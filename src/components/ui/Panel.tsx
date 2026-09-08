import {
  cn,
  densityPadding,
  panelClass,
  type Density,
} from "@/components/ui/styles";

export function Panel(props: {
  children: React.ReactNode;
  density?: Density;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  const Tag = props.as ?? "div";
  const density = props.density ?? "default";
  return (
    <Tag
      className={cn(panelClass, densityPadding[density], props.className)}
    >
      {props.children}
    </Tag>
  );
}
