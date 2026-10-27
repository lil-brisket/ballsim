/** Settings tab routes (the tabs themselves are the Settings hub sub-tabs). */
const SUFFIX = {
  league: "/settings",
  rules: "/settings/rules",
  ai: "/settings/ai",
  tools: "/settings/tools",
} as const;

export type SettingsTabKey = keyof typeof SUFFIX;

export function settingsTabPath(saveId: string, key: SettingsTabKey) {
  return `/dashboard/${saveId}${SUFFIX[key]}`;
}
