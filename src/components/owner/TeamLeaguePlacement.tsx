/**
 * Renders conference/division placement from existing league names.
 *
 * Variants:
 * - Normal + division: two lines ("Coastal Conference" / "Gulf Division")
 * - Compact + division: one line ("Coastal Conference · Gulf Division")
 * - No division (any compact): one line ("Coastal Conference")
 */
export function TeamLeaguePlacement(props: {
  conferenceName: string;
  divisionName: string;
  showDivision?: boolean;
  compact?: boolean;
}) {
  const showDivision = props.showDivision ?? true;
  const compact = props.compact ?? false;
  const conferenceLabel = `${props.conferenceName} Conference`;

  if (!showDivision) {
    return <span className="block text-xs text-zinc-400">{conferenceLabel}</span>;
  }

  const divisionLabel = `${props.divisionName} Division`;

  if (compact) {
    return (
      <span className="block text-xs text-zinc-400">
        {conferenceLabel} · {divisionLabel}
      </span>
    );
  }

  return (
    <span className="block text-xs text-zinc-400">
      <span className="block">{conferenceLabel}</span>
      <span className="block">{divisionLabel}</span>
    </span>
  );
}
