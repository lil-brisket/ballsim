import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

const KEY = "ballsim:rating-display";

async function freshModule() {
  vi.resetModules();
  return import("@/components/ui/rating-display");
}

describe("useRatingDisplay", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("defaults to grades", async () => {
    const { useRatingDisplay } = await freshModule();
    const { result } = renderHook(() => useRatingDisplay());
    expect(result.current[0]).toBe("grades");
  });

  it("renders the default on the server", async () => {
    const { DEFAULT_RATING_DISPLAY } = await freshModule();
    expect(DEFAULT_RATING_DISPLAY).toBe("grades");
    const { renderToString } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { useRatingDisplay } = await freshModule();
    window.localStorage.setItem(KEY, "ratings");
    function Probe() {
      return createElement("span", null, useRatingDisplay()[0]);
    }
    expect(renderToString(createElement(Probe))).toContain("grades");
  });

  it("persists the choice and a new viewer session reads it back", async () => {
    const first = await freshModule();
    const { result } = renderHook(() => first.useRatingDisplay());
    act(() => result.current[1]("ratings"));
    expect(result.current[0]).toBe("ratings");
    expect(window.localStorage.getItem(KEY)).toBe("ratings");
    cleanup();

    const second = await freshModule();
    const { result: reopened } = renderHook(() => second.useRatingDisplay());
    expect(reopened.current[0]).toBe("ratings");
  });

  it("ignores a stored value it does not know", async () => {
    window.localStorage.setItem(KEY, "letters");
    const { useRatingDisplay } = await freshModule();
    const { result } = renderHook(() => useRatingDisplay());
    expect(result.current[0]).toBe("grades");
  });

  it("survives blocked storage: the choice lasts for the session", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { useRatingDisplay } = await freshModule();
    const { result } = renderHook(() => useRatingDisplay());
    expect(result.current[0]).toBe("grades");
    act(() => result.current[1]("ratings"));
    expect(result.current[0]).toBe("ratings");
  });

  it("updates every mounted consumer", async () => {
    const { useRatingDisplay } = await freshModule();
    const a = renderHook(() => useRatingDisplay());
    const b = renderHook(() => useRatingDisplay());
    act(() => a.result.current[1]("ratings"));
    expect(b.result.current[0]).toBe("ratings");
  });
});
