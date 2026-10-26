import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button, buttonClass } from "@/components/ui/Button";
import { NumberStepper } from "@/components/ui/NumberStepper";
import { Select } from "@/components/ui/Select";
import { Tabs } from "@/components/ui/Tabs";

afterEach(cleanup);

describe("Select", () => {
  it("keeps native select semantics for forms", () => {
    render(
      <form aria-label="f">
        <label htmlFor="role">Role</label>
        <Select id="role" name="role" defaultValue="bench">
          <option value="starter">Starter</option>
          <option value="bench">Bench</option>
        </Select>
      </form>,
    );
    const select = screen.getByLabelText("Role") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect(select.name).toBe("role");
    expect(select.value).toBe("bench");
    const data = new FormData(screen.getByRole("form") as HTMLFormElement);
    expect(data.get("role")).toBe("bench");
  });
});

describe("NumberStepper", () => {
  it("steps within min and max and submits as a form field", () => {
    render(
      <form aria-label="f">
        <NumberStepper
          name="minutes"
          defaultValue={29}
          min={0}
          max={30}
          aria-label="Minutes"
        />
      </form>,
    );
    const input = screen.getByLabelText("Minutes") as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "Increase" }));
    expect(input.value).toBe("30");
    expect(
      (screen.getByRole("button", { name: "Increase" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Decrease" }));
    expect(input.value).toBe("29");
    const data = new FormData(screen.getByRole("form") as HTMLFormElement);
    expect(data.get("minutes")).toBe("29");
  });

  it("reports changes when controlled", () => {
    const onValueChange = vi.fn();
    render(
      <NumberStepper value={5} onValueChange={onValueChange} aria-label="N" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Increase" }));
    expect(onValueChange).toHaveBeenCalledWith(6);
  });

  it("clamps a typed value on blur", () => {
    render(<NumberStepper defaultValue={2} min={0} max={10} aria-label="N" />);
    const input = screen.getByLabelText("N") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.blur(input);
    expect(input.value).toBe("10");
  });
});

describe("Button", () => {
  it("defaults to a non-submitting secondary button", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.getAttribute("type")).toBe("button");
    expect(button.className).toContain("border-line-strong");
  });

  it("styles primary with the team colour", () => {
    expect(buttonClass({ variant: "primary" })).toContain("bg-team");
    expect(buttonClass({ variant: "primary" })).toContain("text-on-team");
  });
});

describe("Tabs", () => {
  it("marks the active link tab as the current page", () => {
    render(
      <Tabs
        aria-label="Team"
        activeKey="roster"
        items={[
          { key: "team", label: "Team Hub", href: "/t" },
          { key: "roster", label: "Roster", href: "/r" },
        ]}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Roster" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getByRole("link", { name: "Team Hub" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });

  it("calls onSelect for button tabs", () => {
    const onSelect = vi.fn();
    render(
      <Tabs
        aria-label="Stats"
        activeKey="a"
        items={[
          { key: "a", label: "Season", onSelect: () => {} },
          { key: "b", label: "Career", onSelect },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Career" }));
    expect(onSelect).toHaveBeenCalled();
  });
});
