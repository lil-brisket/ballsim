"use client";

import {
  MomentOverlay,
  MomentReplayButton,
  useMomentGate,
  type MomentStep,
} from "@/components/moments";
import { CountUp } from "@/components/ui/CountUp";
import { OvrBadge } from "@/components/ui/OvrBadge";

const STEPS: readonly MomentStep[] = [
  {
    id: "headline",
    eyebrow: "Offseason",
    title: "Training camp results",
    body: <p>Four players improved, two declined. Team overall +2.</p>,
  },
  {
    id: "riser",
    eyebrow: "Biggest jump",
    title: "Dario Mensah",
    body: (
      <div className="flex items-center gap-4">
        <OvrBadge overall={71} size="md" />
        <span aria-hidden="true">→</span>
        <OvrBadge overall={78} size="md" />
        <span className="font-display text-3xl text-win">
          +<CountUp value={7} />
        </span>
      </div>
    ),
  },
  {
    id: "league",
    eyebrow: "Around the league",
    title: "Top risers",
    sting: true,
    body: (
      <ol className="list-inside list-decimal space-y-1">
        <li>Dario Mensah +7</li>
        <li>Ivo Castell +6</li>
        <li>Remy Okafor +5</li>
      </ol>
    ),
  },
];

/** Demo moment: replay only, so the page never opens it by itself. */
export function MomentShowcase() {
  const gate = useMomentGate("dev", "demo", { eligible: false });
  return (
    <div className="space-y-2">
      <MomentReplayButton onReplay={gate.replay} label="Play demo moment" />
      <MomentOverlay
        open={gate.open}
        onClose={gate.close}
        label="Demo moment"
        steps={STEPS}
        summary={{
          id: "summary",
          eyebrow: "Offseason",
          title: "Training camp results",
          body: (
            <p>
              Four players improved, two declined. Biggest jump: Dario Mensah 71
              → 78 (+7).
            </p>
          ),
        }}
      />
    </div>
  );
}
