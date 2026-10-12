from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")
g = (root / "src/domain/entities/game.ts").read_text(encoding="utf-8")
start = g.find("export type Game = {")
print(g[start : start + 500])
print("---")
sch = (root / "src/systems/calendar/schedule-projection.ts").read_text(encoding="utf-8")
print(re.findall(r"game\.\w+", sch))
print("--- standings row ---")
ss = (root / "src/state/standings-selectors.ts").read_text(encoding="utf-8")
start = ss.find("export type StandingsRowEnriched")
print(ss[start : start + 700])
print("--- my team ---")
start = ss.find("export type MyTeamStandingsContext")
print(ss[start : start + 500])
print("--- build enriched division ---")
# see if division rank exists
print("divisionRank" in ss, "divisionWins" in ss)
# TeamStanding
st = (root / "src/domain/entities/standings.ts").read_text(encoding="utf-8")
print(st[:600])
# project options
pce = (root / "src/systems/calendar/project-calendar-events.ts").read_text(encoding="utf-8")
start = pce.find("export type ProjectCalendarEventsOptions")
print("--- project options ---")
print(pce[start : start + 400])
print("--- importance on events ---")
print("importance" in pce[pce.find("return {") : pce.find("return {") + 200])
# get calendar context
print("getCalendarContext exists", (root / "src/systems/simulation/calendar-context.ts").exists())
cc = (root / "src/systems/simulation/calendar-context.ts").read_text(encoding="utf-8")
print(re.findall(r"export (?:type|function) \w+", cc)[:20])
