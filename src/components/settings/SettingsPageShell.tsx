import type { ReactNode } from "react";
import { ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import type { SettingsTabKey } from "@/components/settings/settings-paths";

export function SettingsPageShell(props: {
  saveId: string;
  /** Which Settings tab this page is (the hub sub-tabs show it). */
  active: SettingsTabKey;
  error?: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Career configuration for this save"
      />
      {props.error ? <ErrorState message={props.error} /> : null}
      {props.children}
    </>
  );
}

/** One-line notice shown when a non-host member views host-only controls. */
export function HostOnlyNotice(props: { children: ReactNode }) {
  return <p className="text-sm text-warning">{props.children}</p>;
}
