export function StatCard(props: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="text-sm font-medium text-zinc-400">{props.label}</h2>
      <div
        className={`mt-2 text-xl text-zinc-50 ${props.mono ? "font-mono" : ""}`}
      >
        {props.value}
      </div>
    </div>
  );
}
