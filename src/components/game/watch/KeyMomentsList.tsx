import {
  EmptyState,
  Panel,
  SectionHeading,
  StatusBadge,
} from "@/components/ui";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { KeyMoment, KeyMomentKind } from "@/state/watch-game-view";

const KIND_LABEL: Record<KeyMomentKind, string> = {
  lead_change: "Lead change",
  tie: "Tie",
  run: "Run",
  clutch: "Clutch",
  foul_out: "Foul out",
  injury: "Injury",
};

const KIND_TONE: Record<KeyMomentKind, string> = {
  lead_change: "active",
  tie: "neutral",
  run: "success",
  clutch: "warning",
  foul_out: "critical",
  injury: "injured",
};

export function visibleKeyMoments(
  keyMoments: KeyMoment[],
  revealed: number,
  isFinal: boolean,
): KeyMoment[] {
  return keyMoments.filter((moment) =>
    moment.playIndex === null ? isFinal : moment.playIndex < revealed,
  );
}

function MomentBody(props: { moment: KeyMoment }) {
  const { moment } = props;
  const when = [moment.periodLabel, moment.clockLabel]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <span className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={KIND_LABEL[moment.kind]}
          tone={KIND_TONE[moment.kind]}
        />
        <span className="font-mono text-xs tabular-nums text-zinc-400">
          {when || "Post-game"}
        </span>
      </span>
      <span className="mt-1 block text-sm font-semibold text-zinc-100">
        {moment.title}
      </span>
      <span className="block text-sm text-zinc-400">{moment.detail}</span>
    </>
  );
}

export function KeyMomentsList(props: {
  keyMoments: KeyMoment[];
  revealed: number;
  isFinal: boolean;
  onJump: (playIndex: number) => void;
}) {
  const moments = visibleKeyMoments(
    props.keyMoments,
    props.revealed,
    props.isFinal,
  );
  return (
    <Panel as="section" className="min-w-0 space-y-3">
      <SectionHeading as="h2" title="Key moments" />
      {moments.length === 0 ? (
        <EmptyState message="No key moments yet." />
      ) : (
        <ul className="space-y-2">
          {moments.map((moment, index) => {
            const playIndex = moment.playIndex;
            return (
              <li key={`${moment.kind}-${playIndex ?? "post"}-${index}`}>
                {playIndex === null ? (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
                    <MomentBody moment={moment} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => props.onJump(playIndex)}
                    className={cn(
                      "block min-h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left hover:border-zinc-600",
                      focusRingClass,
                    )}
                  >
                    <MomentBody moment={moment} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
