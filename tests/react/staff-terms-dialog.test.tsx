import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StaffTermsDialog } from "@/components/staff-coaching/StaffTermsDialog";

afterEach(cleanup);

function renderDialog() {
  return render(
    <StaffTermsDialog
      title="Hire Sam Coach"
      triggerLabel="Offer terms"
      submitLabel="Send offer"
      action={vi.fn()}
      saveId="save_1"
      returnPath="/dashboard/save_1/staff-coaching/hiring-market"
      hiddenFields={{ staffId: "staff_1" }}
      defaultAnnualSalary={500_000}
      defaultYears={2}
    />,
  );
}

describe("StaffTermsDialog focus handling", () => {
  it("moves focus in, traps Tab, closes on Escape and returns focus", () => {
    renderDialog();
    const trigger = screen.getByRole("button", { name: "Offer terms" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Hire Sam Coach" });
    expect(dialog.contains(document.activeElement)).toBe(true);

    const submit = screen.getByRole("button", { name: "Send offer" });
    submit.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(submit);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
