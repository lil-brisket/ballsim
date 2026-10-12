from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")

def exports(path, pattern=r"export (?:type|function|const) (\w+)"):
    text = (root / path).read_text(encoding="utf-8")
    return re.findall(pattern, text)

checks = {
    "project-calendar-events": "src/systems/calendar/project-calendar-events.ts",
    "simulation-preview": "src/systems/calendar/simulation-preview.ts",
    "calendar-context": "src/systems/simulation/calendar-context.ts",
    "phase-engine": "src/systems/phase-engine/index.ts",
    "event-source": "src/domain/entities/event-source.ts",
    "calendar-event": "src/domain/entities/calendar-event.ts",
    "calendar-date": "src/domain/calendar-date.ts",
}

for name, path in checks.items():
    p = root / path
    if not p.exists():
        # try alternate paths
        alts = list(root.glob(f"**/{Path(path).name}"))
        print(f"{name}: MISSING, alts={[str(a.relative_to(root)) for a in alts[:5]]}")
        if alts:
            print("  exports:", exports(alts[0].relative_to(root).as_posix())[:30])
        continue
    print(f"{name}:", exports(path)[:40])

# CalendarContext fields
cc = (root / "src/systems/simulation/calendar-context.ts").read_text(encoding="utf-8")
start = cc.find("export type CalendarContext")
print("CalendarContext:\n", cc[start:start+700])

# simulation preview function + fields
sp = (root / "src/systems/calendar/simulation-preview.ts").read_text(encoding="utf-8")
print("preview fn:", re.findall(r"export function (\w+)", sp))
print("yourTeam or yourTeam:", "yourTeam" in sp, "yourTeam" in sp)

# project options type name
pce = (root / "src/systems/calendar/project-calendar-events.ts").read_text(encoding="utf-8")
print("project options:", re.findall(r"export type (Project\w+)", pce))
print("activeOwner field in project:", re.findall(r"active\w+", pce)[:5])

# phase engine
for p in (root / "src/systems").rglob("*phase*"):
    if p.suffix == ".ts" and "index" in p.name or p.name == "phase-engine.ts":
        pass
alts = list((root / "src/systems").rglob("*phase-engine*"))
print("phase-engine paths:", [str(a.relative_to(root)) for a in alts[:10]])
for a in alts[:3]:
    print(a.name, re.findall(r"export function (\w+)", a.read_text(encoding="utf-8"))[:20])

# competition type literal
g = (root / "src/domain/entities/game.ts").read_text(encoding="utf-8")
print("competition literals:", re.findall(r'"[a-z_]+"', g[g.find("GameCompetitionType"):g.find("GameCompetitionType")+200]))

# calendar event categories include news?
ce = (root / "src/domain/entities/calendar-event.ts").read_text(encoding="utf-8")
print("categories:", re.findall(r'"[a-z_]+"', ce[ce.find("CalendarEventCategory"):ce.find("CalendarEventCategory")+250]))
