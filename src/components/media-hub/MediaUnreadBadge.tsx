export function MediaUnreadBadge(props: { count: number; className?: string }) {
  if (props.count <= 0) {
    return null;
  }

  const label = props.count > 99 ? "99+" : String(props.count);

  return (
    <span
      className={
        props.className ??
        "inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-950"
      }
      aria-label={`${props.count} unread`}
    >
      {label}
    </span>
  );
}
