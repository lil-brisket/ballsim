"use client";

import { useSyncExternalStore } from "react";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import { NavGroups } from "@/components/game/NavGroups";
import { cn, focusRingClass } from "@/components/ui/styles";

const STORAGE_KEY = "ballsim:ownerNavCollapsed";

const collapsedListeners = new Set<() => void>();

function readCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapsed(onStoreChange: () => void): () => void {
  collapsedListeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    collapsedListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function writeCollapsedPreference(next: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // ignore
  }
  for (const listener of collapsedListeners) {
    listener();
  }
}

export function DesktopNavigation(props: {
  saveId: string;
  groups?: readonly OwnerNavGroup[];
}) {
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsedPreference,
    () => false,
  );

  function toggleCollapsed() {
    writeCollapsedPreference(!collapsed);
  }

  return (
    <nav
      className={cn(
        "arena-panel hidden shrink-0 p-2 lg:block",
        collapsed ? "w-16" : "w-60",
      )}
      aria-label="Owner Mode"
    >
      <div className="mb-2 flex items-center justify-end">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-pressed={collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "rounded-md border border-surface-line px-2 py-1 text-sm text-muted hover:border-team-ink hover:text-team-ink",
            focusRingClass,
          )}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
      <NavGroups
        saveId={props.saveId}
        groups={props.groups}
        collapsed={collapsed}
      />
    </nav>
  );
}
