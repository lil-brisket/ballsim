import { describe, expect, it } from "vitest";
import { splitColdHistory, withSaveHistory } from "@/persistence/save-history";
import { toLeagueHubView } from "@/state/league-hub-selectors";
import { leagueWithHistory } from "../persistence/save-history-fixture";

describe("toLeagueHubView", () => {
  it("does not depend on finished-season history, so it can skip loading it", () => {
    const { hot, chunks } = splitColdHistory(leagueWithHistory());
    expect(chunks.length).toBeGreaterThan(0);
    let full = hot;
    for (const chunk of chunks) {
      full = withSaveHistory(full, chunk.history);
    }
    expect(toLeagueHubView(hot)).toEqual(toLeagueHubView(full));
  });
});
