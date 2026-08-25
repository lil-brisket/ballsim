import type {
  AiAssistDomainMode,
  AiAssistanceDomains,
  GameSettings,
} from "@/domain/game-settings";

export type ResolvedAiAssistMode = Exclude<AiAssistDomainMode, "inherit">;

/**
 * Resolve a domain assist mode against the global managementMode.
 * `inherit` maps: off → off, smart_assist → smart, full_management → full.
 */
export function resolveDomainAssistMode(
  settings: GameSettings,
  domain: keyof AiAssistanceDomains,
): ResolvedAiAssistMode {
  const domainMode = settings.ai.assistance[domain];
  if (domainMode !== "inherit") {
    return domainMode;
  }
  switch (settings.ai.managementMode) {
    case "off":
      return "off";
    case "full_management":
      return "full";
    case "smart_assist":
    default:
      return "smart";
  }
}

export function isAiAssistEnabledForDomain(
  settings: GameSettings,
  domain: keyof AiAssistanceDomains,
): boolean {
  return resolveDomainAssistMode(settings, domain) !== "off";
}
