"use client";

import { useState } from "react";
import type { OwnerNavGroup } from "@/application/owner-nav-config";
import { NavGroups } from "@/components/game/NavGroups";
import { cn, focusRingClass } from "@/components/ui/styles";

const STORAGE_KEY = "ballsim:ownerNavCollapsed";

function readCollapsedPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function DesktopNavigation(props: {
  saveId: string;
  groups?: readonly OwnerNavGroup[];
}) {
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <nav
      className={cn("hidden shrink-0 lg:block", collapsed ? "w-14" : "w-56")}
      aria-label="Owner Mode"
    >
      <div className="mb-3 flex items-center justify-end">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-pressed={collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-amber-600 hover:text-amber-400",
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
