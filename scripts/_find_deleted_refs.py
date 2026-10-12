from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")

# References to deleted components
deleted = [
    "SimulationShortcuts",
    "CalendarFilters",
    "SimulateUntilPanel",
    "CalendarDayDetail",
    "CalendarTodayBriefing",
]
for name in deleted:
    hits = []
    for p in root.rglob("*.{ts,tsx}"):
        pass
    for p in list((root / "src").rglob("*.ts")) + list((root / "src").rglob("*.tsx")) + list((root / "tests").rglob("*.ts")) + list((root / "tests").rglob("*.tsx")):
        try:
            t = p.read_text(encoding="utf-8")
        except Exception:
            continue
        if name in t:
            hits.append(str(p.relative_to(root)))
    print(name, hits[:10])

# franchise media field exact
ofs = (root / "src/state/owned-franchise-state.ts").read_text(encoding="utf-8")
print("media fields", re.findall(r"media\w+", ofs)[:20])

# buildSimulationSummary call in game-service
svc = (root / "src/application/game-service.ts").read_text(encoding="utf-8")
print(re.search(r"return buildSimulationSummary\([\s\S]{0,200}\)", svc[svc.find("loadCalendarPageView"):svc.find("loadCalendarPageView")+5000]))
