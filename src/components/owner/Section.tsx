export function Section(props: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium text-zinc-100">{props.title}</h2>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}
