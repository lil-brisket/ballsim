import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function ownerBase(saveId: string): string {
  return `/dashboard/${saveId}`;
}

export function revalidateOwner(saveId: string): void {
  revalidatePath(ownerBase(saveId), "layout");
}

export function redirectWithError(path: string, error: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(error)}`);
}

export function returnPath(formData: FormData, saveId: string): string {
  const raw = String(formData.get("returnPath") ?? "");
  if (
    raw.startsWith(`/dashboard/${saveId}`) ||
    raw.startsWith(`/fantasy-draft/${saveId}`) ||
    raw.startsWith(`/new/${saveId}/fantasy-draft`)
  ) {
    return raw;
  }
  return ownerBase(saveId);
}
