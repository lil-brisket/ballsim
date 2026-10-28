"use client";

import { useRouter } from "next/navigation";
import type { CalendarPageView } from "@/application/game-service";
import { OwnerDecisionInterruptModal } from "@/components/calendar/OwnerDecisionInterruptModal";
import { SimulationPausedBanner } from "@/components/calendar/SimulationPausedBanner";
import {
  interruptBannerVisible,
  interruptModalOpen,
  type InterruptUiEvent,
  type InterruptResolveAction,
  type InterruptUiState,
} from "@/components/calendar/calendar-interrupt-state";

/** Owner-decision interrupt modal, or the paused banner when it is closed. */
export function CalendarInterruptPanel(props: {
  view: CalendarPageView;
  saveId: string;
  interruptState: InterruptUiState;
  dispatchInterrupt: (action: InterruptUiEvent) => void;
  resumeTarget: string | null;
  currentDate: string;
  onResolve: (action: InterruptResolveAction) => Promise<void>;
}) {
  const router = useRouter();
  const { view, interruptState, dispatchInterrupt, resumeTarget } = props;
  return (
    <>
      {interruptModalOpen(interruptState) &&
      (interruptState.status === "interrupted" ||
        interruptState.status === "resolving") ? (
        <OwnerDecisionInterruptModal
          interrupt={interruptState.interrupt}
          resumeTo={resumeTarget}
          busy={interruptState.status === "resolving"}
          error={
            interruptState.status === "interrupted"
              ? interruptState.error
              : null
          }
          onAccept={() => {
            void props.onResolve("accept");
          }}
          onDecline={() => {
            void props.onResolve("decline");
          }}
          onLetAiDecide={() => {
            void props.onResolve("let_ai_decide");
          }}
          onNegotiate={() => {
            if (
              interruptState.status !== "interrupted" ||
              interruptState.interrupt.kind !== "trade_offer"
            ) {
              return;
            }
            const params = new URLSearchParams();
            if (resumeTarget) {
              params.set("resumeTo", resumeTarget);
            }
            const query = params.toString();
            router.push(
              `/dashboard/${props.saveId}/trades/${interruptState.interrupt.decisionId}/negotiate${query ? `?${query}` : ""}`,
            );
          }}
          onStopSimulation={() => dispatchInterrupt({ type: "dismiss" })}
        />
      ) : null}

      {!interruptModalOpen(interruptState) ? (
        <SimulationPausedBanner
          reason={view.pauseBanner.reason}
          message={view.pauseBanner.message}
          resolveHref={view.pauseBanner.resolveHref}
          currentDate={props.currentDate}
          onResolve={
            interruptBannerVisible(interruptState) || view.interrupt
              ? () => dispatchInterrupt({ type: "reopen" })
              : undefined
          }
        />
      ) : null}
    </>
  );
}
