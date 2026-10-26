"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { playUiSound } from "@/components/ui/sound/ui-sound";

export type SimulationActivityProgress = {
  currentDate: string;
  daysAdvanced: number;
  daysRequested: number;
  percentComplete: number;
  phase: string;
} | null;

type SimulationActivityContextValue = {
  simulationPending: boolean;
  setSimulationPending: (pending: boolean) => void;
  simulationProgress: SimulationActivityProgress;
  setSimulationProgress: (progress: SimulationActivityProgress) => void;
};

const SimulationActivityContext =
  createContext<SimulationActivityContextValue | null>(null);

export function SimulationActivityProvider(props: {
  children: ReactNode;
  /** Test/helpers: start already pending (e.g. calendar lock regression). */
  initialPending?: boolean;
}) {
  const [simulationPending, setSimulationPendingState] = useState(
    props.initialPending === true,
  );
  const [simulationProgress, setSimulationProgressState] =
    useState<SimulationActivityProgress>(null);
  // Cues on the pending edge only; the first render never plays.
  const wasPending = useRef(simulationPending);
  useEffect(() => {
    if (wasPending.current === simulationPending) return;
    wasPending.current = simulationPending;
    playUiSound(simulationPending ? "simStart" : "simDone");
  }, [simulationPending]);
  const setSimulationPending = useCallback((pending: boolean) => {
    setSimulationPendingState(pending);
  }, []);
  const setSimulationProgress = useCallback(
    (progress: SimulationActivityProgress) => {
      setSimulationProgressState(progress);
    },
    [],
  );

  const value = useMemo(
    () => ({
      simulationPending,
      setSimulationPending,
      simulationProgress,
      setSimulationProgress,
    }),
    [
      simulationPending,
      setSimulationPending,
      simulationProgress,
      setSimulationProgress,
    ],
  );

  return (
    <SimulationActivityContext.Provider value={value}>
      {props.children}
    </SimulationActivityContext.Provider>
  );
}

export function useSimulationActivity(): SimulationActivityContextValue {
  const ctx = useContext(SimulationActivityContext);
  if (ctx == null) {
    return {
      simulationPending: false,
      setSimulationPending: () => {},
      simulationProgress: null,
      setSimulationProgress: () => {},
    };
  }
  return ctx;
}

/**
 * Place inside a simulation &lt;form&gt; so useFormStatus can report pending
 * to the shared activity context (locks calendar nav / other advance UIs).
 */
export function SimulationPendingReporter() {
  const { pending } = useFormStatus();
  const { setSimulationPending } = useSimulationActivity();

  useEffect(() => {
    setSimulationPending(pending);
    return () => {
      setSimulationPending(false);
    };
  }, [pending, setSimulationPending]);

  return null;
}

/**
 * Locks app chrome (header, navigation) while a calendar simulation runs so
 * nothing outside the calendar can be pressed until it finishes or is stopped.
 */
export function SimulationLockRegion(props: {
  children: ReactNode;
  className?: string;
}) {
  const { simulationPending } = useSimulationActivity();
  return (
    <div
      inert={simulationPending}
      aria-disabled={simulationPending || undefined}
      data-simulation-locked={simulationPending ? "true" : undefined}
      className={[
        props.className ?? "",
        "transition-opacity",
        simulationPending ? "opacity-50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {props.children}
    </div>
  );
}
