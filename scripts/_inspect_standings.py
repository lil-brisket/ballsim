from pathlib import Path

root = Path(r"c:\Users\dynam\Documents\Basketball")
ss = (root / "src/state/standings-selectors.ts").read_text(encoding="utf-8")
start = ss.find("export type StandingsRowEnriched")
print(ss[start : start + 650])
print("--- imports top ---")
print("\n".join(ss.splitlines()[:25]))
print("--- toMyTeam return keys area ---")
start = ss.find("export function toMyTeamStandingsContext")
print(ss[start : start + 900])
