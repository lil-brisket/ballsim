"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  advanceOwnerDay,
  createNewOwnerSave,
  loadOwnerSave,
} from "@/application/game-service";

export async function createSaveAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "New Franchise");
  const result = await createNewOwnerSave({ name });
  revalidatePath("/");
  redirect(`/dashboard/${result.save.id}`);
}

export async function openSaveAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const loaded = await loadOwnerSave(saveId);
  if (!loaded) {
    throw new Error("Save not found.");
  }
  redirect(`/dashboard/${loaded.save.id}`);
}

export async function advanceDayAction(formData: FormData): Promise<void> {
  const saveId = String(formData.get("saveId") ?? "");
  const result = await advanceOwnerDay(saveId);
  if (!result) {
    throw new Error("Save not found.");
  }
  revalidatePath(`/dashboard/${saveId}`);
  redirect(`/dashboard/${saveId}`);
}
