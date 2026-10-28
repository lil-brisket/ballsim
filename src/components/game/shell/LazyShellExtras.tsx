"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import { OPEN_COMMAND_PALETTE } from "@/components/game/shell/hub-keys";

/*
 * Shell features that only matter after an interaction load on demand, so
 * their code is not part of every page's first load.
 */

const CommandPalette = dynamic(
  () =>
    import("@/components/game/shell/CommandPalette").then(
      (module) => module.CommandPalette,
    ),
  { ssr: false },
);

const GamepadBridge = dynamic(
  () =>
    import("@/components/game/shell/GamepadBridge").then(
      (module) => module.GamepadBridge,
    ),
  { ssr: false },
);

/**
 * Loads the command palette on its first open request (`/`, Ctrl/Cmd+K, the
 * search button) and mounts it open; later opens go straight to the
 * palette's own listener.
 */
export function LazyCommandPalette(props: {
  saveId: string;
  groups: readonly OwnerNavGroup[];
}) {
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (requested) return;
    function onOpen() {
      setRequested(true);
    }
    window.addEventListener(OPEN_COMMAND_PALETTE, onOpen);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE, onOpen);
  }, [requested]);

  if (!requested) return null;
  return (
    <CommandPalette saveId={props.saveId} groups={props.groups} openOnMount />
  );
}

function padConnected(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.getGamepads === "function" &&
    Array.from(navigator.getGamepads()).some((pad) => pad !== null)
  );
}

/** Loads the gamepad bridge once a pad is connected (or already is). */
export function LazyGamepadBridge() {
  // The bridge renders nothing, so the server/client initial value may differ.
  const [hasPad, setHasPad] = useState(padConnected);

  useEffect(() => {
    if (hasPad) return;
    function onConnected() {
      setHasPad(true);
    }
    window.addEventListener("gamepadconnected", onConnected);
    return () => window.removeEventListener("gamepadconnected", onConnected);
  }, [hasPad]);

  return hasPad ? <GamepadBridge /> : null;
}
