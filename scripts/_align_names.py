from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")

# What game-service now expects
svc = (root / "src/application/game-service.ts").read_text(encoding="utf-8")
load = svc[svc.find("export async function loadCalendarPageView"):svc.find("export async function loadCalendarPageView")+3500]
print("=== load snippet helpers ===")
for line in load.splitlines():
    if any(x in line for x in ["buildCalendar", "getNext", "toCalendar", "media", "buildSimulation", "addCalendar"]):
        print(line)

print("\n=== export name alignment ===")
insp = (root / "src/systems/calendar/calendar-inspector.ts").read_text(encoding="utf-8")
print("inspector exports", re.findall(r"export (?:type|function) (\w+)", insp))
sch = (root / "src/systems/calendar/schedule-projection.ts").read_text(encoding="utf-8")
print("schedule exports", re.findall(r"export (?:type|function) (\w+)", sch))
ss = (root / "src/state/standings-selectors.ts").read_text(encoding="utf-8")
print("league ctx", re.findall(r"export (?:type|function) (CalendarLeague\w+|toCalendar\w+)", ss))

# buildSimulationSummary signature
sm = (root / "src/systems/calendar/simulation-summary.ts").read_text(encoding="utf-8")
print("summary fns", re.findall(r"export function (\w+)", sm))
print(sm[sm.find("export function build"):sm.find("export function build")+400])

# franchise media field
print("mediaFeed in svc load", "mediaFeed" in load, "mediaFeed" in load)
