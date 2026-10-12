from pathlib import Path
import re
text = Path(r"c:\Users\dynam\Documents\Basketball\src\application\game-service.ts").read_text(encoding="utf-8")
load_start = text.find("export async function loadCalendarPageView")
next_fn = text.find("\nexport async function ", load_start + 10)
old_load = text[load_start:next_fn]
for line in old_load.splitlines():
    if any(k in line for k in ["parseCalendar", "getCalendar", "toOwner", "getActive", "toSave", "toDashboard", "buildSimulation", "addCalendar", "franchise.", "media"]):
        print(line)
