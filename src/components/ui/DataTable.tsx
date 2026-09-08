export function DataTable(props: {
  headers: string[];
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-left text-sm">
        {props.caption ? (
          <caption className="sr-only">{props.caption}</caption>
        ) : null}
        <thead className="bg-zinc-900 text-zinc-400">
          <tr>
            {props.headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{props.children}</tbody>
      </table>
    </div>
  );
}
