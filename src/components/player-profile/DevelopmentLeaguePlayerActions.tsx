"use client";

import { SectionHeading } from "@/components/ui/SectionHeading";
import { buttonClass } from "@/components/ui/Button";
import {
  assignToDevelopmentLeagueAction,
  recallFromDevelopmentLeagueAction,
} from "@/application/actions";

export function DevelopmentLeaguePlayerActions(props: {
  saveId: string;
  playerId: string;
  returnPath: string;
  canAssign: boolean;
  canRecall: boolean;
  statusLabel: string | null;
  readinessLabel: string | null;
  whyBullets: string[];
}) {
  if (!props.canAssign && !props.canRecall && props.statusLabel == null) {
    return null;
  }

  return (
    <section className="rounded-lg border border-line bg-surface-raised/40 p-4">
      <SectionHeading as="h3" size="sm" title="Development League" />
      {props.statusLabel ? (
        <p className="mt-1 text-sm text-muted">
          Status: {props.statusLabel}
          {props.readinessLabel ? ` · ${props.readinessLabel}` : ""}
        </p>
      ) : null}
      {props.whyBullets.length > 0 ? (
        <ul className="mt-2 list-disc pl-4 text-sm text-faint">
          {props.whyBullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {props.canAssign ? (
          <form action={assignToDevelopmentLeagueAction}>
            <input type="hidden" name="saveId" value={props.saveId} />
            <input type="hidden" name="playerId" value={props.playerId} />
            <input type="hidden" name="returnPath" value={props.returnPath} />
            <button
              type="submit"
              className={buttonClass({ variant: "primary" })}
            >
              Send to Development League
            </button>
          </form>
        ) : null}
        {props.canRecall ? (
          <form action={recallFromDevelopmentLeagueAction}>
            <input type="hidden" name="saveId" value={props.saveId} />
            <input type="hidden" name="playerId" value={props.playerId} />
            <input type="hidden" name="returnPath" value={props.returnPath} />
            <button
              type="submit"
              className={buttonClass({ variant: "secondary" })}
            >
              Recall to Top League
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
