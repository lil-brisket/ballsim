"use client";

import { useState } from "react";
import { updateCoachingPhilosophyAction } from "@/application/actions";
import { buttonClass } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  DEFENSE_LABELS,
  EMPHASIS_LABELS,
  PACE_LABELS,
  defenseExplanation,
  emphasisExplanation,
  focalExplanation,
  paceExplanation,
  rotationExplanation,
} from "@/components/staff-coaching/coaching-copy";
import type { CoachingView } from "@/state/team-management-selectors";

function Hint(props: { children: React.ReactNode }) {
  return <span className="text-sm text-faint">{props.children}</span>;
}

export function CoachingPhilosophyForm(props: {
  saveId: string;
  returnPath: string;
  coaching: Pick<
    CoachingView,
    "teamId" | "philosophy" | "rotationStyle" | "focalPlayerOptions"
  >;
}) {
  const { saveId, returnPath, coaching } = props;
  const [pace, setPace] = useState(coaching.philosophy.pace);
  const [emphasis, setEmphasis] = useState(
    coaching.philosophy.offensiveEmphasis,
  );
  const [defense, setDefense] = useState(coaching.philosophy.defensiveApproach);
  const [focalId, setFocalId] = useState(
    coaching.philosophy.focalPlayerId ?? "",
  );
  const focal = coaching.focalPlayerOptions.find(
    (option) => option.playerId === focalId,
  );

  return (
    <form
      action={updateCoachingPhilosophyAction}
      className="grid gap-4 sm:grid-cols-2"
    >
      <input type="hidden" name="saveId" value={saveId} />
      <input type="hidden" name="teamId" value={coaching.teamId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <label className="flex flex-col gap-1 text-sm text-faint">
        Pace
        <Select
          name="pace"
          value={pace}
          onChange={(event) => setPace(event.target.value)}
          wrapperClassName="w-full"
        >
          {Object.entries(PACE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Hint>{paceExplanation(pace)}</Hint>
      </label>
      <label className="flex flex-col gap-1 text-sm text-faint">
        Offensive emphasis
        <Select
          name="offensiveEmphasis"
          value={emphasis}
          onChange={(event) => setEmphasis(event.target.value)}
          wrapperClassName="w-full"
        >
          {Object.entries(EMPHASIS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Hint>{emphasisExplanation(emphasis)}</Hint>
      </label>
      <label className="flex flex-col gap-1 text-sm text-faint">
        Defensive approach
        <Select
          name="defensiveApproach"
          value={defense}
          onChange={(event) => setDefense(event.target.value)}
          wrapperClassName="w-full"
        >
          {Object.entries(DEFENSE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Hint>{defenseExplanation(defense)}</Hint>
      </label>
      <label className="flex flex-col gap-1 text-sm text-faint">
        Play through
        <Select
          name="focalPlayerId"
          value={focalId}
          onChange={(event) => setFocalId(event.target.value)}
          wrapperClassName="w-full"
        >
          <option value="">Nobody (spread the ball)</option>
          {coaching.focalPlayerOptions.map((option) => (
            <option key={option.playerId} value={option.playerId}>
              {option.name} · {option.position} · OVR {option.overall}
            </option>
          ))}
        </Select>
        <Hint>{focalExplanation(focal?.name ?? null)}</Hint>
      </label>
      <div className="sm:col-span-2">
        <p className="mb-2 text-sm text-faint">
          Rotation style:{" "}
          <span className="text-soft">{coaching.rotationStyle}</span>.{" "}
          {rotationExplanation(coaching.rotationStyle)} Set by the chosen
          preset.
        </p>
        <button type="submit" className={buttonClass({ variant: "primary" })}>
          Save coaching
        </button>
      </div>
    </form>
  );
}
