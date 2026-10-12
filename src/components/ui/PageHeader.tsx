import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * Page title block for in-save pages: broadcast heading (display font with a
 * team-colour underline), optional subtitle and an actions slot.
 */
export function PageHeader(props: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-surface-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <SectionHeading as="h1" size="lg" title={props.title} />
        {props.subtitle ? (
          <div className="text-sm text-zinc-300">{props.subtitle}</div>
        ) : null}
      </div>
      {props.actions ? (
        <div className="flex flex-wrap gap-2">{props.actions}</div>
      ) : null}
    </header>
  );
}
