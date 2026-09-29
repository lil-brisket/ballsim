import { Section } from "@/components/owner/Section";
import { panelClass, cn } from "@/components/ui/styles";
import {
  AwardWinnerName,
  AwardWinnerTeam,
} from "@/components/history/AwardWinnerLinks";
import type {
  AwardAvailability,
  CurrentSeasonAwardGroup,
  CurrentSeasonAwardSlot,
} from "@/state/awards-hub-selectors";

const STATUS_COPY: Record<AwardAvailability, string> = {
  won: "",
  pending: "Season ongoing.",
  not_started: "Not yet available",
  not_applicable: "",
};

function AwardSlotCard(props: {
  saveId: string;
  slot: CurrentSeasonAwardSlot;
}) {
  const { slot } = props;
  return (
    <li className={cn(panelClass, "px-4 py-3")}>
      <p className="text-xs uppercase tracking-wide text-zinc-500">
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
      ) : (
        <p className="mt-1 text-sm text-zinc-400">{STATUS_COPY[slot.status]}</p>
      )}
    </li>
  );
}

export function CurrentSeasonAwards(props: {
  saveId: string;
  seasonYear: number;
  groups: CurrentSeasonAwardGroup[];
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-400">{props.seasonYear} season</p>
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
