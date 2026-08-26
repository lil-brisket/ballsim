import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TeamNicknameField } from "@/components/team/TeamNicknameField";

describe("TeamNicknameField", () => {
  it("renders a labeled input and reports changes", () => {
    const onChange = vi.fn();
    render(
      <TeamNicknameField
        id="team-nickname"
        value="Knights"
        onChange={onChange}
        helperText="You can customize your team name."
      />,
    );
    expect(screen.getByLabelText("Team name")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Team name"), {
      target: { value: "Falcons" },
    });
    expect(onChange).toHaveBeenCalledWith("Falcons");
  });

  it("shows an inline error", () => {
    render(
      <TeamNicknameField
        id="team-nickname"
        value=""
        onChange={() => {}}
        error="Team name cannot be empty."
      />,
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "Team name cannot be empty.",
    );
  });

  it("randomizes when the button is clicked", () => {
    const onRandomize = vi.fn();
    render(
      <TeamNicknameField
        id="team-nickname"
        value="Knights"
        onChange={() => {}}
        onRandomize={onRandomize}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Randomize team name" }));
    expect(onRandomize).toHaveBeenCalledTimes(1);
  });
});
