export function SettingRow(props: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 px-4 py-3">
      <dt className="text-sm text-zinc-400">{props.label}</dt>
      <dd className="mt-1 text-zinc-100">{props.value}</dd>
      {props.description ? (
        <p className="mt-1 text-sm text-zinc-500">{props.description}</p>
      ) : null}
    </div>
  );
}
