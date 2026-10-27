/** Neutral verified badge: never a team colour, so it reads the same everywhere. */
export function VerifiedMark() {
  return (
    <>
      <svg
        viewBox="0 0 24 24"
        width={16}
        height={16}
        aria-hidden="true"
        focusable={false}
        className="shrink-0 text-soft"
      >
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path
          d="M7.5 12.5l3 3 6-6.5"
          fill="none"
          stroke="var(--surface-arena)"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">Verified</span>
    </>
  );
}
