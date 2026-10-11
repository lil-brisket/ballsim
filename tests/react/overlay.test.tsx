import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Overlay } from "@/components/ui/Overlay";

describe("Overlay", () => {
  it("omits Close overlay when dismissible is false", () => {
    const onClick = vi.fn();
    render(
      <Overlay dismissible={false} onClick={onClick}>
        <div role="dialog">panel</div>
      </Overlay>,
    );
    expect(screen.queryByLabelText("Close overlay")).toBeNull();
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders a Close overlay control when dismissible", () => {
    const onClick = vi.fn();
    render(<Overlay onClick={onClick} />);
    fireEvent.click(screen.getByLabelText("Close overlay"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
