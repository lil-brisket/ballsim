import { getRequestSaveStore } from "@/application/request-save-store";
import { toSearchIndex } from "@/state/search-index";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** League index for the command palette (read-only; access-checked load). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ saveId: string }> },
) {
  const { saveId } = await params;
  const loaded = await getRequestSaveStore().load(saveId);
  if (!loaded) {
    return Response.json(
      { error: "Save not found" },
      { status: 404, headers: NO_STORE },
    );
  }
  return Response.json(toSearchIndex(loaded.state), { headers: NO_STORE });
}
