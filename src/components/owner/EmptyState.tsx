export function EmptyState(props: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-8 text-center text-sm text-zinc-500">
      {props.message}
    </p>
  );
}

export function ErrorState(props: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-rose-800/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200"
    >
      {props.message}
    </p>
  );
}
