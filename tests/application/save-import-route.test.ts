import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const importOwnerSave = vi.fn();
vi.mock("@/application/game-service", () => ({
  importOwnerSave: (text: string) => importOwnerSave(text),
  MAX_SAVE_IMPORT_BYTES: 16,
}));

import { POST } from "@/app/api/saves/import/route";

function upload(content: string | null, origin = "http://localhost:3000") {
  const form = new FormData();
  if (content !== null) {
    form.set("saveFile", new File([content], "league.ballsim.json"));
  }
  return POST(
    new Request("http://localhost:3000/api/saves/import", {
      method: "POST",
      headers: { origin, host: "localhost:3000" },
      body: form,
    }),
  );
}

describe("save import route", () => {
  it("opens the imported save", async () => {
    importOwnerSave.mockResolvedValue({ ok: true, save: { id: "save_new" } });
    const response = await upload("{}");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/dashboard/save_new");
    expect(importOwnerSave).toHaveBeenCalledWith("{}");
  });

  it("sends errors back to the saves page", async () => {
    importOwnerSave.mockResolvedValue({ ok: false, error: "Bad file." });
    expect((await upload("{}")).headers.get("location")).toBe(
      "/saves?error=Bad%20file.",
    );
    expect((await upload(null)).headers.get("location")).toMatch(
      /Choose%20a%20save%20file/,
    );
    expect((await upload("x".repeat(17))).headers.get("location")).toMatch(
      /too%20large/,
    );
  });

  it("refuses cross-site posts", async () => {
    const response = await upload("{}", "https://evil.example");
    expect(response.status).toBe(403);
  });
});
