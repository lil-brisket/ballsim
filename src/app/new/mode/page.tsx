import { redirect } from "next/navigation";

/** Mode selection now lives on /home. */
export default function ModeSelectionRedirectPage() {
  redirect("/home");
}
