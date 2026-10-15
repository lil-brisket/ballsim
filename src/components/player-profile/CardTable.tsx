/** DataTable styled like the player card tables (mono uppercase headers). */
export function CardTable(props: {
  headers: string[];
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="min-w-full text-left text-sm">
        {props.caption ? (
          <caption className="sr-only">{props.caption}</caption>
        ) : null}
        <thead className="bg-zinc-900/60">
          <tr className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-zinc-400">
            {props.headers.map((header) => (
              <th key={header} scope="col" className="px-3 py-2 font-normal">
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
