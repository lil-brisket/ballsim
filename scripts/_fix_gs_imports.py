from pathlib import Path
import re
svc = Path(r"c:\Users\dynam\Documents\Basketball\src\application\game-service.ts").read_text(encoding="utf-8")
# show lines mentioning getNextTeamGameDate / buildCalendarDateInspectorView / toCalendarLeagueContext
for i, line in enumerate(svc.splitlines(), 1):
    if any(x in line for x in ["getNextTeamGameDate", "buildCalendarDateInspectorView", "toCalendarLeagueContext", "owner-context", "systems/calendar"]):
        if i < 400 or "loadCalendar" in "".join(svc.splitlines()[max(0,i-5):i+1]):
            print(f"{i}:{line}")
