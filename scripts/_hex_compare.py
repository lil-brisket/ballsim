from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")
sp = (root / "src/systems/calendar/simulation-preview.ts").read_text(encoding="utf-8")
insp = (root / "src/systems/calendar/calendar-inspector.ts").read_text(encoding="utf-8")

sum_sp = re.search(r"export function (summarize\w+)", sp).group(1)
sum_insp = re.search(r"import \{ (summarize\w+)", insp).group(1)
print("summarize equal", sum_sp == sum_insp, repr(sum_sp), repr(sum_insp))

# yourTeam key in preview type
m = re.search(r"yourTeam|yourTeam", sp[sp.find("export type SimulationRangePreview"):sp.find("export type SimulationRangePreview")+250])
print("preview key match", m.group(0) if m else None)
print(sp[sp.find("export type SimulationRangePreview"):sp.find("export type SimulationRangePreview")+200])

# yourTeam usage in inspector
print("inspector yourTeam", "yourTeam" in insp, "yourTeam" in insp)

# Fix inspector to use exact names from preview file
preview_key = re.search(r"\n  (\w+): SimulationRangeYourTeamPreview", sp).group(1)
print("exact your team key:", repr(preview_key))

# seasonStory exact
cc = (root / "src/systems/simulation/calendar-context.ts").read_text(encoding="utf-8")
story = re.search(r"\n  (season\w+): string", cc[cc.find("export type CalendarContext"):cc.find("export type CalendarContext")+700])
print("story field:", repr(story.group(1) if story else None))

# CalendarEventView exact
ce = (root / "src/domain/entities/calendar-event.ts").read_text(encoding="utf-8")
print("event view:", re.search(r"export type (CalendarEvent\w+) = \{", ce).group(1))

# GameState exact  
gs = (root / "src/state/game-state.ts").read_text(encoding="utf-8")
print("state type:", re.search(r"export type (Game\w+) = \{", gs).group(1))
