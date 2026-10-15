import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const createLeagueInviteAction = vi.fn();

vi.mock("@/application/actions/online-league", () => ({
  createLeagueInviteAction: (...a: unknown[]) => createLeagueInviteAction(...a),
}));

import { InviteCreator } from "@/components/game/InviteCreator";

function renderCreator() {
  return render(
    <InviteCreator saveId="save1" defaultDays={7} maxDays={30} maxUses={7} />,
  );
}

describe("InviteCreator", () => {
  afterEach(() => {
    createLeagueInviteAction.mockReset();
  });

  it("shows the one-time link after success", async () => {
    createLeagueInviteAction.mockResolvedValue({ ok: true, token: "tok123" });
    const { container, unmount } = renderCreator();
    fireEvent.click(screen.getByRole("button", { name: "Create invite link" }));
    await waitFor(() =>
      expect(container.textContent).toContain("This link is shown once."),
    );
    expect(createLeagueInviteAction).toHaveBeenCalledWith("save1", {
      maxUses: 7,
      days: 7,
    });
    const input = screen.getByLabelText("Invite link") as HTMLInputElement;
    expect(input.value).toBe(`${window.location.origin}/join/tok123`);
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    unmount();
  });

  it("shows the error on failure and no link", async () => {
    createLeagueInviteAction.mockResolvedValue({
      ok: false,
      error: "Only the host can invite.",
    });
    const { container, unmount } = renderCreator();
    fireEvent.click(screen.getByRole("button", { name: "Create invite link" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Only the host can invite.",
      ),
    );
    expect(container.textContent).not.toContain("This link is shown once.");
    unmount();
  });
});
