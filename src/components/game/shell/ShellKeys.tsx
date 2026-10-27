"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import {
  hasOpenPopup,
  hubForKey,
  isIdleFocus,
  isTypingOrModal,
  OPEN_COMMAND_PALETTE,
  parentPathFor,
  simHref,
} from "@/components/game/shell/hub-keys";
import { hubTransitionTypes } from "@/components/game/shell/transition-direction";
import { useActiveNav } from "@/components/game/shell/use-active-nav";
import { useSimulationActivity } from "@/components/game/simulation-activity";
import { setInputMode } from "@/components/ui/focus/input-mode";
import { playUiSound } from "@/components/ui/sound/ui-sound";

/**
 * Global keys for the save: Q/E step between hubs and 1–n jump; Esc goes up a
 * level (tab → hub → Home); Space opens Sim (same as the Sim button, which
 * keeps the calendar's confirm rules) when nothing interactive has focus;
 * `/` or Ctrl/Cmd+K opens search. Never fires while typing, while a dialog
 * or menu is open, or during a simulation. Also records whether the viewer
 * is using keyboard or pointer (for focus restoration). Renders nothing.
 */
export function ShellKeys(props: {
  saveId: string;
  groups: readonly OwnerNavGroup[];
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const active = useActiveNav(props.saveId, props.groups);
  const activeId = active?.hub.id;
  const { simulationPending } = useSimulationActivity();
  const { saveId, groups } = props;

  useEffect(() => {
    const base = `/dashboard/${saveId}`;
    const path = pathname.startsWith(base) ? pathname.slice(base.length) : "";

    // Slide types only when the hub changes; plain pushes crossfade.
    function pushWithTypes(href: string, transitionTypes: string[]) {
      if (transitionTypes.length > 0) router.push(href, { transitionTypes });
      else router.push(href);
    }

    function onKeyDown(event: KeyboardEvent) {
      setInputMode("keyboard");
      if (simulationPending || event.repeat) return;

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "k"
      ) {
        if (document.querySelector('[aria-modal="true"]')) return;
        event.preventDefault();
        window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE));
        return;
      }
      if (isTypingOrModal(event)) return;

      if (event.key === "/") {
        event.preventDefault();
        window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE));
        return;
      }
      if (event.key === "Escape") {
        if (hasOpenPopup()) return;
        const parent = parentPathFor(groups, activeId, path);
        if (parent === undefined) return;
        event.preventDefault();
        playUiSound("back");
        // Up to Home slides back; tab to hub stays in the hub (crossfade).
        pushWithTypes(
          `${base}${parent}`,
          hubTransitionTypes(
            groups,
            activeId,
            parent === "" ? "home" : activeId,
          ),
        );
        return;
      }
      if (event.key === " " && isIdleFocus()) {
        event.preventDefault();
        router.push(simHref(saveId));
        return;
      }
      const hub = hubForKey(event.key, groups, activeId);
      if (!hub || hub.id === activeId) return;
      event.preventDefault();
      playUiSound("move");
      pushWithTypes(
        `${base}${hub.href}`,
        hubTransitionTypes(groups, activeId, hub.id),
      );
    }
    function onPointerDown() {
      setInputMode("pointer");
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [router, pathname, saveId, groups, activeId, simulationPending]);

  return null;
}
