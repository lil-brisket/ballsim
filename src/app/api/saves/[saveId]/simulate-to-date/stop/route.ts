import { canAccessOwnerSave } from "@/application/game-service";
import { requestSimulationStop } from "@/application/simulation-stop-requests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ask the in-flight calendar simulation for this save to stop after the current day. */
export async function POST(
  _request: Request,
  context: { params: Promise<{ saveId: string }> },
): Promise<Response> {
  const { saveId } = await context.params;
  if (!(await canAccessOwnerSave(saveId))) {
    return Response.json({ message: "Save not found." }, { status: 404 });
  }
  const stopping = requestSimulationStop(saveId);
  return Response.json({ ok: true, stopping });
}
