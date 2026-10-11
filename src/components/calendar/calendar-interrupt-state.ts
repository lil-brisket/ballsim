import {
  calendarInterruptKey,
  type CalendarInterrupt,
} from "@/state/calendar-interrupt";

export type InterruptResolveAction = "accept" | "decline" | "let_ai_decide";

export type InterruptUiState =
  | { status: "idle" }
  | {
      status: "interrupted";
      interrupt: CalendarInterrupt;
      dismissed: boolean;
      error: string | null;
    }
  | {
      status: "resolving";
      interrupt: CalendarInterrupt;
      action: InterruptResolveAction;
    }
  | { status: "resuming"; resumeTo: string };

export type InterruptUiEvent =
  | { type: "sync"; interrupt: CalendarInterrupt | null }
  | { type: "dismiss" }
  | { type: "reopen" }
  | { type: "start_resolve"; action: InterruptResolveAction }
  | {
      type: "resolve_success";
      interrupt: CalendarInterrupt | null;
      resumeTo: string | null;
    }
  | { type: "resolve_error"; error: string }
  | { type: "resume_started" };

export const INITIAL_INTERRUPT_STATE: InterruptUiState = { status: "idle" };

export function reduceInterruptState(
  state: InterruptUiState,
  event: InterruptUiEvent,
): InterruptUiState {
  switch (event.type) {
    case "sync": {
      if (event.interrupt == null) {
        if (state.status === "resuming") {
          return state;
        }
        return { status: "idle" };
      }
      if (
        (state.status === "interrupted" || state.status === "resolving") &&
        calendarInterruptKey(state.interrupt) ===
          calendarInterruptKey(event.interrupt)
      ) {
        if (state.status === "interrupted") {
          return { ...state, interrupt: event.interrupt };
        }
        return state;
      }
      return {
        status: "interrupted",
        interrupt: event.interrupt,
        dismissed: false,
        error: null,
      };
    }
    case "dismiss": {
      if (state.status !== "interrupted") {
        return state;
      }
      return { ...state, dismissed: true, error: null };
    }
    case "reopen": {
      if (state.status !== "interrupted") {
        return state;
      }
      return { ...state, dismissed: false };
    }
    case "start_resolve": {
      if (state.status !== "interrupted" || state.dismissed) {
        return state;
      }
      return {
        status: "resolving",
        interrupt: state.interrupt,
        action: event.action,
      };
    }
    case "resolve_success": {
      if (event.interrupt) {
        return {
          status: "interrupted",
          interrupt: event.interrupt,
          dismissed: false,
          error: null,
        };
      }
      if (event.resumeTo) {
        return { status: "resuming", resumeTo: event.resumeTo };
      }
      return { status: "idle" };
    }
    case "resolve_error": {
      if (state.status !== "resolving") {
        return state;
      }
      return {
        status: "interrupted",
        interrupt: state.interrupt,
        dismissed: false,
        error: event.error,
      };
    }
    case "resume_started": {
      return { status: "idle" };
    }
    default: {
      return state;
    }
  }
}

export function interruptModalOpen(state: InterruptUiState): boolean {
  if (state.status === "resolving") {
    return true;
  }
  return state.status === "interrupted" && !state.dismissed;
}

export function interruptBannerVisible(state: InterruptUiState): boolean {
  return state.status === "interrupted" && state.dismissed;
}
