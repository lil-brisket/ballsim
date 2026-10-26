"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import { hubForKey, isTypingOrModal } from "@/components/game/shell/hub-keys";
import { useActiveNav } from "@/components/game/shell/use-active-nav";
import { useSimulationActivity } from "@/components/game/simulation-activity";

/**
 * Global hub keys: Q/E step between hubs, 1–n jump. Never fires while typing
 * in a field, with a modifier held, while a dialog is open or while a
 * simulation runs (the nav is inert then too). Renders
 * nothing; the same links stay clickable and tabbable.
 */
export function HubKeys(props: {
  saveId: string;
  groups: readonly OwnerNavGroup[];
}) {
  const router = useRouter();
  const active = useActiveNav(props.saveId, props.groups);
  const activeId = active?.hub.id;
  const { simulationPending } = useSimulationActivity();
  const { saveId, groups } = props;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (simulationPending || event.repeat || isTypingOrModal(event)) return;
      const hub = hubForKey(event.key, groups, activeId);
      if (!hub || hub.id === activeId) return;
      event.preventDefault();
      router.push(`/dashboard/${saveId}${hub.href}`);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, saveId, groups, activeId, simulationPending]);

  return null;
}
