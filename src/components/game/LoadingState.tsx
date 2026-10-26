export function LoadingState(props: { message?: string }) {
  return (
    <p
      role="status"
      className="rounded-xl border border-line bg-surface-raised/40 px-4 py-8 text-center text-sm text-muted"
    >
      {props.message ?? "Loading…"}
    </p>
  );
}
