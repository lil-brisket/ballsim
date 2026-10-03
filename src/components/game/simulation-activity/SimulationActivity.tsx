"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

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
