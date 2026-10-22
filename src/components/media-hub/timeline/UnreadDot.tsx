/** The one unread marker, rendered once per post, right after the time. */
export function UnreadDot() {
  return (
    <>
      <span
        aria-hidden="true"
        className="inline-block h-2 w-2 rounded-full bg-team-ink"
      />
      <span className="sr-only">Unread</span>
    </>
  );
}
