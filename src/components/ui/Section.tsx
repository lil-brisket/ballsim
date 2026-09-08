import { cn, densitySectionSpace, type Density } from "@/components/ui/styles";

export function Section(props: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  density?: Density;
  className?: string;
}) {
  const density = props.density ?? "default";
  return (
    <section className={cn(densitySectionSpace[density], props.className)}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-zinc-100">{props.title}</h2>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}
