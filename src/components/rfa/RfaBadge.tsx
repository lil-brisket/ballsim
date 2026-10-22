import type { RfaTag } from "@/state/rfa-selectors";

export function RfaBadge(props: { tag: RfaTag }) {
  const text = `Restricted: ${props.tag.originalTeamName} can match`;
  return (
    <span
      title={text}
      aria-label={text}
      className="inline-flex rounded-full border border-team-ink/50 bg-team/15 px-2 py-0.5 text-xs font-medium text-team-ink"
    >
      RFA
    </span>
  );
}
