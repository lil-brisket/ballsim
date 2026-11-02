"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import { OPEN_COMMAND_PALETTE } from "@/components/game/shell/shell-links";

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

/**
 * Loads the command palette on its first open request (the search button) and mounts it open; later opens go straight to the
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
