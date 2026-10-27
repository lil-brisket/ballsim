import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { rowLinkClass } from "@/components/league/row-link-class";
import { Section } from "@/components/ui/Section";
import { panelClass, cn } from "@/components/ui/styles";
import {
  AwardWinnerName,
  AwardWinnerTeam,
} from "@/components/history/AwardWinnerLinks";
import {
  formatRaceWeekLabel,
  type AwardAvailability,
  type AwardRaceContenderView,
  type CurrentSeasonAwardGroup,
  type CurrentSeasonAwardSlot,
} from "@/state/awards-hub-selectors";

const STATUS_COPY: Record<AwardAvailability, string> = {
  won: "",
  pending: "Race takes shape after the first full week.",
  not_started: "Not yet available",
  not_applicable: "",
};

/** Player contenders link to the player; coaches have no href. */
function ContenderName(props: {
  saveId: string;
  contender: AwardRaceContenderView;
}) {
  const { contender } = props;
  if (contender.href) {
    return (
      <PlayerEntityLink
        saveId={props.saveId}
        playerId={contender.subjectId}
        className={rowLinkClass}
      >
        {contender.name}
      </PlayerEntityLink>
    );
  }
  return <span className="text-ink">{contender.name}</span>;
}

function AwardRace(props: {
  saveId: string;
  race: NonNullable<CurrentSeasonAwardSlot["race"]>;
}) {
  const contenders = props.race.contenders.slice(0, 5);
  return (
    <div className="mt-1">
      <p className="text-sm text-faint">
        {formatRaceWeekLabel(props.race.throughDate)}
      </p>
      <ol className="mt-1 space-y-0.5 text-sm">
        {contenders.map((contender) => (
          <li key={contender.subjectId} className="flex items-baseline gap-2">
            <span className="w-4 shrink-0 text-right tabular-nums text-faint">
              {contender.rank}
            </span>
            <span className="min-w-0 truncate">
              <ContenderName saveId={props.saveId} contender={contender} />
            </span>
            {contender.teamAbbreviation ? (
              <span className="ml-auto shrink-0 text-sm text-faint">
                {contender.teamAbbreviation}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function AwardSlotCard(props: {
  saveId: string;
  slot: CurrentSeasonAwardSlot;
}) {
  const { slot } = props;
  return (
    <li className={cn(panelClass, "px-4 py-3")}>
      <p className="text-sm text-muted">
        {slot.displayName}
        {slot.periodLabel ? ` · ${slot.periodLabel}` : ""}
      </p>
      {slot.status === "won" && slot.winner ? (
        <div className="mt-1 space-y-0.5">
          <p className="font-medium">
            <AwardWinnerName saveId={props.saveId} row={slot.winner} />
          </p>
          <p className="text-sm">
            <AwardWinnerTeam saveId={props.saveId} row={slot.winner} />
          </p>
        </div>
      ) : slot.race && slot.race.contenders.length > 0 ? (
        <AwardRace saveId={props.saveId} race={slot.race} />
      ) : (
        <p className="mt-1 text-sm text-muted">{STATUS_COPY[slot.status]}</p>
      )}
    </li>
  );
}

export function CurrentSeasonAwards(props: {
  saveId: string;
  seasonYear: number;
  groups: CurrentSeasonAwardGroup[];
}) {
  const anyRace = props.groups.some((group) =>
    group.slots.some((slot) => slot.race && slot.race.contenders.length > 0),
  );
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">{props.seasonYear} season</p>
      {anyRace ? (
        <p className="text-sm text-faint">
          Rankings update every Monday. Voters decide the winner, so the leader
          is not guaranteed the award.
        </p>
      ) : null}
      {props.groups.map((group) => {
        const slots = group.slots.filter(
          (slot) => slot.status !== "not_applicable",
        );
        if (slots.length === 0) return null;
        return (
          <Section key={group.tier} title={group.label}>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slots.map((slot) => (
                <AwardSlotCard
                  key={slot.key}
                  saveId={props.saveId}
                  slot={slot}
                />
              ))}
            </ul>
          </Section>
        );
      })}
    </div>
  );
}
