export function LoadingState(props: { message?: string }) {
  return (
    <p
      role="status"
      className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-400"
    >
      {props.message ?? "Loading…"}
    </p>
  );
}
