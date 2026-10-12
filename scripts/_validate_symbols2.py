from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")

# Exact names
es = (root / "src/domain/entities/event-source.ts").read_text(encoding="utf-8")
print("importance fn:", re.findall(r"export function (importance\w+)", es))

sp = (root / "src/systems/calendar/simulation-preview.ts").read_text(encoding="utf-8")
print("summarize fn:", re.findall(r"export function (summarize\w+)", sp))
print("yourTeam key:", "yourTeam:" in sp, "yourTeam:" in sp)
# print the return type fields
start = sp.find("export type SimulationRangePreview")
print(sp[start:start+400])

cc = (root / "src/systems/simulation/calendar-context.ts").read_text(encoding="utf-8")
print("getCalendarContext:", "export function getCalendarContext" in cc)
print("displayLabel:", "displayLabel" in cc)
print("tradeDeadlineDate:", "tradeDeadlineDate" in cc)

# phase engine files
pe = root / "src/systems/phase-engine"
for p in pe.rglob("*.ts"):
    text = p.read_text(encoding="utf-8")
    fns = re.findall(r"export function (\w+)", text)
    if fns:
        print(p.name, fns[:15])

# game-service phase imports
svc = (root / "src/application/game-service.ts").read_text(encoding="utf-8")
for line in svc.splitlines():
    if "Phase" in line and ("import" in line or "getActive" in line or "getPhase" in line) and line.strip().startswith(("import", "get", "  get", "  find", "phase")):
        if "phase" in line.lower():
            print("SVC:", line.strip()[:120])

# competition type for development
g = (root / "src/domain/entities/game.ts").read_text(encoding="utf-8")
print("comp types:", re.findall(r'"[a-z_]+"', g[g.find("GameCompetitionType"):g.find("GAME_COMPETITION_TYPES")+120]))

# CalendarEventView name
ce = (root / "src/domain/entities/calendar-event.ts").read_text(encoding="utf-8")
print("event view type:", re.findall(r"export type (CalendarEvent\w+)", ce))

# parseCalendarDate location
print("parse in calendar-date domain:", "parseCalendarDate" in (root/"src/domain/calendar-date.ts").read_text(encoding="utf-8"))
