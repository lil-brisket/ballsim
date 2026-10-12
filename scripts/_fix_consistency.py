from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")

# What schedule actually exports now
sch = (root / "src/systems/calendar/schedule-projection.ts").read_text(encoding="utf-8")
print("schedule exports:", re.findall(r"export (?:type|function) (\w+)", sch))
print("schedule type body:")
start = sch.find("export type TeamCalendarGameView")
print(sch[start:start+500])

# What inspector imports/uses
insp = (root / "src/systems/calendar/calendar-inspector.ts").read_text(encoding="utf-8")
print("\ninspector imports/calls:")
for line in insp.splitlines():
    if any(x in line for x in ["import", "summarize", "getCalendar", "projectTeam", "yourTeam", "seasonStory", "displayLabel", "opponent"]):
        if not line.strip().startswith("*") and not line.strip().startswith("//"):
            print(line)

# Exact preview keys
sp = (root / "src/systems/calendar/simulation-preview.ts").read_text(encoding="utf-8")
print("\npreview yourTeam vs yourTeam:", "yourTeam:" in sp, "yourTeam:" in sp)
print("summarize name:", re.search(r"export function (summarize\w+)", sp).group(1))

# Exact context
cc = (root / "src/systems/simulation/calendar-context.ts").read_text(encoding="utf-8")
print("getCalendarContext:", "export function getCalendarContext" in cc)
print("seasonStory field:", "seasonStory:" in cc)
print("displayLabel field:", "displayLabel:" in cc)
