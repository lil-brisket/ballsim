import { exportOwnerSave } from "@/application/game-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Download the whole league (history included) as a save file. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ saveId: string }> },
): Promise<Response> {
  const { saveId } = await context.params;
  const exported = await exportOwnerSave(saveId);
  if (!exported) {
    return Response.json({ message: "Save not found." }, { status: 404 });
  }
  return new Response(exported.json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exported.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
