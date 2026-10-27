import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DataTable } from "@/components/ui/DataTable";
import { TableKeys } from "@/components/ui/focus/TableKeys";

afterEach(cleanup);

function key(name: string, init: KeyboardEventInit = {}) {
  const target = document.activeElement as HTMLElement;
  const notPrevented = fireEvent.keyDown(target, { key: name, ...init });
  return !notPrevented;
}

function Plain() {
  return (
    <TableKeys>
      <table>
        <thead>
          <tr>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <button>a1</button>
              <button>a2</button>
            </td>
          </tr>
          <tr>
            <td>no controls</td>
          </tr>
          <tr>
            <td>
              <button>c1</button>
            </td>
          </tr>
          <tr>
            <td>
              <button>d1</button>
              <input aria-label="field" />
            </td>
          </tr>
        </tbody>
      </table>
    </TableKeys>
  );
}

describe("TableKeys", () => {
  it("moves between rows, skipping rows without controls, and stops at ends", () => {
    render(<Plain />);
    screen.getByText("a2").focus();
    expect(key("ArrowDown")).toBe(true);
    expect(document.activeElement).toBe(screen.getByText("c1"));
    key("ArrowDown");
    expect(document.activeElement).toBe(screen.getByText("d1"));
    expect(key("ArrowDown")).toBe(false);
    expect(document.activeElement).toBe(screen.getByText("d1"));
    key("ArrowUp");
    key("ArrowUp");
    expect(document.activeElement).toBe(screen.getByText("a1"));
    expect(key("ArrowUp")).toBe(false);
  });

  it("ignores modifiers and fields", () => {
    render(<Plain />);
    screen.getByText("a1").focus();
    expect(key("ArrowDown", { ctrlKey: true })).toBe(false);
    expect(document.activeElement).toBe(screen.getByText("a1"));
    screen.getByLabelText("field").focus();
    expect(key("ArrowUp")).toBe(false);
    expect(key("ArrowLeft")).toBe(false);
    expect(document.activeElement).toBe(screen.getByLabelText("field"));
  });

  it("does not add tab stops", () => {
    const { container } = render(<Plain />);
    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
  });

  it("does nothing on left/right without sortable headers", () => {
    render(<Plain />);
    screen.getByText("a1").focus();
    expect(key("ArrowRight")).toBe(false);
  });
});

describe("DataTable sortable headers", () => {
  function Sortable(props: { spies: Array<() => void> }) {
    return (
      <DataTable
        headers={[
          "Name",
          { label: "A", sort: { onSelect: props.spies[0] } },
          { label: "B", sort: { onSelect: props.spies[1], direction: "asc" } },
          { label: "C", sort: { onSelect: props.spies[2] } },
        ]}
      >
        <tr>
          <td>
            <button>r1</button>
          </td>
        </tr>
        <tr>
          <td>
            <button>r2</button>
          </td>
        </tr>
      </DataTable>
    );
  }

  it("left/right click the neighbouring sort control", () => {
    const spies = [vi.fn(), vi.fn(), vi.fn()];
    render(<Sortable spies={spies} />);
    screen.getByText("r1").focus();
    expect(key("ArrowRight")).toBe(true);
    expect(spies[2]).toHaveBeenCalledTimes(1);
    key("ArrowLeft");
    expect(spies[0]).toHaveBeenCalledTimes(1);
    expect(spies[1]).not.toHaveBeenCalled();
  });

  it("down from a header enters the first row; rows move with arrows", () => {
    render(<Sortable spies={[vi.fn(), vi.fn(), vi.fn()]} />);
    screen.getByRole("button", { name: /^A/ }).focus();
    key("ArrowDown");
    expect(document.activeElement).toBe(screen.getByText("r1"));
    key("ArrowDown");
    expect(document.activeElement).toBe(screen.getByText("r2"));
  });
});
