import { revalidatePath } from "next/cache";
import {
  importOwnerSave,
  MAX_SAVE_IMPORT_BYTES,
} from "@/application/game-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a save from an uploaded save file. A route handler rather than a
 * server action: actions cap request bodies at 1 MB, and long leagues are
 * far bigger.
 */
export async function POST(request: Request): Promise<Response> {
  // Relative Location: behind a proxy, request.url carries the internal host.
  const back = (path: string) =>
    new Response(null, { status: 303, headers: { Location: path } });
  const backWithError = (message: string) =>
    back(`/saves?error=${encodeURIComponent(message)}`);

  // Same-origin form posts only, checked the way Next checks server actions.
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin !== null && URL.parse(origin)?.host !== host) {
    return Response.json({ message: "Forbidden." }, { status: 403 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("saveFile");
  } catch {
    return backWithError("Choose a save file to import.");
  }
  if (!(file instanceof File) || file.size === 0) {
    return backWithError("Choose a save file to import.");
  }
  if (file.size > MAX_SAVE_IMPORT_BYTES) {
    return backWithError("That save file is too large to import.");
  }

  const result = await importOwnerSave(await file.text());
  if (!result.ok) {
    return backWithError(result.error);
  }
  revalidatePath("/home");
  revalidatePath("/saves");
  return back(`/dashboard/${result.save.id}`);
}
