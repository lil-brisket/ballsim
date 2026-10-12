import { SectionHeading } from "@/components/ui/SectionHeading";
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
      <SectionHeading
        as="h2"
        title={props.title}
        action={props.action}
        className="min-h-11"
      />
      {props.children}
    </section>
  );
}
