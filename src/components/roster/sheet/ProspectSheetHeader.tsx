"use client";

import type { ReactNode } from "react";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { useEntityDrawer } from "@/components/entity/EntityDrawerProvider";
import { OvrRing } from "@/components/roster/sheet/OvrRing";
import { RatingRangeCell } from "@/components/roster/sheet/RatingRangeCell";
import { SheetHeaderFrame } from "@/components/roster/sheet/SheetHeader";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/components/ui/styles";
import { formatRatingRange } from "@/presentation/rating-grade";
import type { ProspectSheetRow } from "@/state/prospect-sheet-view";

function FactList(props: { title: string; items: string[]; tone: string }) {
  if (props.items.length === 0) return null;
  return (
    <div>
      <SectionHeading as="h4" size="xs" title={props.title} />
      <ul className={cn("mt-1 space-y-0.5 text-sm", props.tone)}>
        {props.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Fact(props: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{props.label}</dt>
      <dd className="font-semibold text-ink">{props.children}</dd>
    </div>
  );
}

/**
 * The selected prospect's summary above the scouting sheet. Only scouting
 * estimates are shown: the ring sits at the midpoint of the estimated overall
 * and says so, and a prospect without an estimate shows dashes. `actions` is
 * server-built (the draft and add-to-board forms) and rendered as given.
 */
export function ProspectSheetHeader(props: {
  prospect: ProspectSheetRow;
  actions?: ReactNode;
}) {
  const { prospect } = props;
  const { openPlayer } = useEntityDrawer();
  const overall = prospect.overall;
  const midpoint = overall ? Math.round((overall.min + overall.max) / 2) : null;
  const delta =
    prospect.projectedPick != null && prospect.previousProjectedPick != null
      ? prospect.previousProjectedPick - prospect.projectedPick
      : null;

  return (
    <SheetHeaderFrame
      label="Selected prospect"
      identity={
        <>
          <PlayerPortrait
            playerId={prospect.playerId}
            portrait={prospect.portrait}
            firstName={prospect.firstName}
            lastName={prospect.lastName}
            size="md"
          />
          <div className="min-w-0">
            <SectionHeading
              as="h3"
              size="display"
              title={`${prospect.firstName} ${prospect.lastName}`}
              titleClassName="truncate text-2xl font-bold leading-tight text-ink sm:text-3xl"
            />
            <p className="text-sm text-muted">
              {prospect.position}
              {prospect.age != null ? ` · Age ${prospect.age}` : ""}
              {prospect.nationality ? ` · ${prospect.nationality}` : ""}
            </p>
          </div>
          {overall && midpoint !== null ? (
            <div className="flex flex-col items-center">
              <OvrRing
                overall={midpoint}
                size="md"
                label={`Estimated overall ${formatRatingRange(overall, "ratings").label}`}
              />
              <span className="text-sm text-muted">
                Est. <RatingRangeCell range={overall} mode="ratings" plain />
              </span>
            </div>
          ) : null}
        </>
      }
      middle={
        <div className="min-w-0 flex-1 space-y-2">
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <Fact label="Scout grade">{prospect.scoutGrade ?? "—"}</Fact>
            <Fact label="Confidence">
              <span className="capitalize">{prospect.confidence ?? "—"}</span>
            </Fact>
            <Fact label="Knowledge">
              <span className="capitalize">{prospect.knowledgeLevel}</span>
            </Fact>
            <Fact label="Potential">
              <RatingRangeCell
                range={prospect.potential}
                mode="ratings"
                plain
              />
            </Fact>
            <Fact label="Projected pick">
              {prospect.projectedPick != null ? (
                <>
                  #{prospect.projectedPick}
                  {delta != null && delta !== 0 ? (
                    <span
                      className={delta > 0 ? "ml-2 text-win" : "ml-2 text-loss"}
                    >
                      <span aria-hidden>
                        {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}
                      </span>
                      <span className="sr-only">
                        {delta > 0 ? "up" : "down"} {Math.abs(delta)}
                      </span>
                    </span>
                  ) : null}
                </>
              ) : (
                "—"
              )}
            </Fact>
          </dl>
          <div className="hidden gap-x-8 gap-y-2 sm:flex sm:flex-wrap">
            <FactList
              title="Strengths"
              items={prospect.strengths}
              tone="text-win"
            />
            <FactList
              title="Weaknesses"
              items={prospect.weaknesses}
              tone="text-loss"
            />
          </div>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => openPlayer(prospect.playerId)}
          >
            Open card
          </Button>
          {props.actions}
        </div>
      }
    />
  );
}
