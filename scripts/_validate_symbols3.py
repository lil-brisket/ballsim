from pathlib import Path
import re
root = Path(r"c:\Users\dynam\Documents\Basketball")

# ids
ids = (root / "src/domain/ids.ts").read_text(encoding="utf-8")
print("TeamId:", "export type TeamId" in ids)
print("SaveId:", "export type SaveId" in ids)
print(re.findall(r"export type (TeamId|SaveId|GameId)", ids))

# event-source path and importance
print("event-source exists", (root/"src/domain/entities/event-source.ts").exists())
es = (root/"src/domain/entities/event-source.ts").read_text(encoding="utf-8")
print(re.findall(r"export function (\w+)", es))

# GameState
print("GameState file", (root/"src/state/game-state.ts").exists())
gs = (root/"src/state/game-state.ts").read_text(encoding="utf-8")
print("export GameState", "export type GameState" in gs)

# Preview yourTeam games field
sp = (root/"src/systems/calendar/simulation-preview.ts").read_text(encoding="utf-8")
start = sp.find("export type SimulationRangeYourTeamPreview")
print(sp[start:start+200])

# CalendarContext exact field names
cc = (root/"src/systems/simulation/calendar-context.ts").read_text(encoding="utf-8")
start = cc.find("export type CalendarContext")
block = cc[start:start+600]
for field in ["displayLabel","tradeDeadlineDate","daysUntilTradeDeadline","seasonStory","lifecyclePhase"]:
    print(field, field in block)

# parseCalendarDate module path used by game-service
svc = (root/"src/application/game-service.ts").read_text(encoding="utf-8")
for line in svc.splitlines():
    if "parseCalendarDate" in line and "import" in line:
        print(line.strip())
        break
for line in svc.splitlines():
    if "calendar-date" in line:
        print(line.strip())
        break
