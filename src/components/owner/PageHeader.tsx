export function PageHeader(props: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          {props.title}
        </h1>
        {props.subtitle ? (
          <p className="text-sm text-zinc-400">{props.subtitle}</p>
        ) : null}
      </div>
      {props.actions ? (
        <div className="flex flex-wrap gap-2">{props.actions}</div>
      ) : null}
    </header>
  );
}
