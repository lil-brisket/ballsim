import type { ReactNode } from "react";
import { ErrorState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  SettingsSubNav,
  type SettingsSubNavKey,
} from "@/components/settings/SettingsSubNav";

export function SettingsPageShell(props: {
  saveId: string;
  active: SettingsSubNavKey;
  error?: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Career configuration for this save"
      />
      <SettingsSubNav saveId={props.saveId} active={props.active} />
      {props.error ? <ErrorState message={props.error} /> : null}
      {props.children}
    </>
  );
}

/** One-line notice shown when a non-host member views host-only controls. */
export function HostOnlyNotice(props: { children: ReactNode }) {
  return <p className="text-sm text-warning">{props.children}</p>;
}
