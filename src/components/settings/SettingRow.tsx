export function SettingRow(props: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-line px-4 py-3">
      <dt className="text-sm text-muted">{props.label}</dt>
      <dd className="mt-1 text-ink">{props.value}</dd>
      {props.description ? (
        <p className="mt-1 text-sm text-faint">{props.description}</p>
      ) : null}
    </div>
  );
}
