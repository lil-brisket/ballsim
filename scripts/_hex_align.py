from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")
svc = (root / "src/application/game-service.ts").read_text(encoding="utf-8")
insp = (root / "src/systems/calendar/calendar-inspector.ts").read_text(encoding="utf-8")
sch = (root / "src/systems/calendar/schedule-projection.ts").read_text(encoding="utf-8")
ss = (root / "src/state/standings-selectors.ts").read_text(encoding="utf-8")

pairs = [
    ("inspector", re.search(r"buildCalendar\w+", svc).group(0), re.search(r"export function (buildCalendar\w+)", insp).group(1)),
    ("nextGame", re.search(r"getNextTeam\w+", svc).group(0), re.search(r"export function (getNextTeam\w+)", sch).group(1)),
    ("league", re.search(r"toCalendar\w+", svc).group(0), re.search(r"export function (toCalendar\w+)", ss).group(1)),
]
for label, a, b in pairs:
    print(label, a == b, repr(a), repr(b))

# media field on franchise - search OwnedFranchise type
for p in (root / "src").rglob("*franchise*"):
    if p.suffix == ".ts":
        t = p.read_text(encoding="utf-8", errors="ignore")
        if "mediaFeed" in t or "mediaFeed" in t:
            print(p.relative_to(root), "mediaFeed" in t, "mediaFeed" in t)

# BuildSimulationSummaryOptions fields
sm = (root / "src/systems/calendar/simulation-summary.ts").read_text(encoding="utf-8")
start = sm.find("export type BuildSimulationSummaryOptions")
print(sm[start:start+300])
