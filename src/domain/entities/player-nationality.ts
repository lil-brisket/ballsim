export type PlayerNationality =
  | "USA"
  | "Canada"
  | "Mexico"
  | "Brazil"
  | "Argentina"
  | "Spain"
  | "France"
  | "Germany"
  | "Italy"
  | "Serbia"
  | "Greece"
  | "Australia"
  | "New Zealand"
  | "Nigeria"
  | "Senegal"
  | "Japan"
  | "China"
  | "Philippines";

export const PLAYER_NATIONALITIES: readonly PlayerNationality[] = [
  "USA",
  "Canada",
  "Mexico",
  "Brazil",
  "Argentina",
  "Spain",
  "France",
  "Germany",
  "Italy",
  "Serbia",
  "Greece",
  "Australia",
  "New Zealand",
  "Nigeria",
  "Senegal",
  "Japan",
  "China",
  "Philippines",
] as const;

export const NATIONALITY_LABELS: Record<PlayerNationality, string> = {
  USA: "United States",
  Canada: "Canada",
  Mexico: "Mexico",
  Brazil: "Brazil",
  Argentina: "Argentina",
  Spain: "Spain",
  France: "France",
  Germany: "Germany",
  Italy: "Italy",
  Serbia: "Serbia",
  Greece: "Greece",
  Australia: "Australia",
  "New Zealand": "New Zealand",
  Nigeria: "Nigeria",
  Senegal: "Senegal",
  Japan: "Japan",
  China: "China",
  Philippines: "Philippines",
};

export function isPlayerNationality(value: string): value is PlayerNationality {
  return (PLAYER_NATIONALITIES as readonly string[]).includes(value);
}
