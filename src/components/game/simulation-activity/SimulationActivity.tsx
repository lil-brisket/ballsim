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

type SimulationActivityContextValue = {
  simulationPending: boolean;
  setSimulationPending: (pending: boolean) => void;
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
  const setSimulationPending = useCallback((pending: boolean) => {
    setSimulationPendingState(pending);
  }, []);

  const value = useMemo(
    () => ({ simulationPending, setSimulationPending }),
    [simulationPending, setSimulationPending],
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
