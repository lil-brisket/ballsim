import { Tabs } from "@/components/ui/Tabs";

/** The single sub-navigation row for the Settings pages (Issue #191). */
const LINKS = [
  { key: "league", suffix: "/settings", label: "League" },
  { key: "rules", suffix: "/settings/rules", label: "Rules" },
  { key: "ai", suffix: "/settings/ai", label: "AI Management" },
  { key: "tools", suffix: "/settings/tools", label: "Tools" },
] as const;

export type SettingsSubNavKey = (typeof LINKS)[number]["key"];

export function settingsTabPath(saveId: string, key: SettingsSubNavKey) {
  const link = LINKS.find((entry) => entry.key === key)!;
  return `/dashboard/${saveId}${link.suffix}`;
}

export function SettingsSubNav(props: {
  saveId: string;
  active: SettingsSubNavKey;
}) {
  return (
    <Tabs
      aria-label="Settings"
      className="mb-6"
      activeKey={props.active}
      items={LINKS.map((link) => ({
        key: link.key,
        label: link.label,
        href: settingsTabPath(props.saveId, link.key),
      }))}
    />
  );
}
