import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IntentLink } from "@/components/ui/IntentLink";

vi.mock("next/link", () => ({
  default: ({
    prefetch,
    href,
    ...rest
  }: React.ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest} />
  ),
}));

describe("IntentLink", () => {
  it("prefetches the full page only while the player shows intent", () => {
    render(<IntentLink href="/team">Team</IntentLink>);
    const link = screen.getByRole("link", { name: "Team" });
    expect(link.dataset.prefetch).toBe("undefined");

    fireEvent.mouseEnter(link);
    expect(link.dataset.prefetch).toBe("true");
    fireEvent.mouseLeave(link);
    expect(link.dataset.prefetch).toBe("undefined");

    fireEvent.focus(link);
    expect(link.dataset.prefetch).toBe("true");
    fireEvent.blur(link);
    expect(link.dataset.prefetch).toBe("undefined");

    fireEvent.touchStart(link);
    expect(link.dataset.prefetch).toBe("true");
  });
});
