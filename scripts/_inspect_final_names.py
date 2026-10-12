from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")
cm = (root / "src/systems/calendar/calendar-month.ts").read_text(encoding="utf-8")
print(re.findall(r"Calendar\w+", cm))
sch = (root / "src/systems/calendar/schedule-projection.ts").read_text(encoding="utf-8")
print("schedule team fields:", re.findall(r"\w+TeamId", sch))
g = (root / "src/domain/entities/game.ts").read_text(encoding="utf-8")
print("game team fields:", re.findall(r"\w+TeamId", g[:2500]))
# importanceAtLeast helper?
es = (root / "src/domain/entities/event-source.ts").read_text(encoding="utf-8")
print(re.findall(r"export function \w+", es))
# phase label helpers in game-service
svc = (root / "src/application/game-service.ts").read_text(encoding="utf-8")
# get exact import names for calendar block
for line in svc.splitlines():
    if "from \"@/systems/calendar\"" in line or line.strip().startswith("findNext") or line.strip().startswith("getCalendar") or line.strip().startswith("summarize") or "getTeamGame" in line:
        if "calendar" in line.lower() or "Simulation" in line or "TeamGame" in line or "findNext" in line or "summarize" in line or "getCalendar" in line:
            print("IMP:", line.strip())
