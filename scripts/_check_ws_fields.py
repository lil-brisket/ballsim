from pathlib import Path

root = Path(r"c:\Users\dynam\Documents\Basketball")
# Fix workspace to match exact view + banner props
ws = (root / "src/components/calendar/CalendarWorkspace.tsx").read_text(encoding="utf-8")
# print mismatches by checking expected symbols
view_fields = [
    "monthGrid", "inspector", "leagueContext", "nextTeamGameDate",
    "timeDisabled", "pauseBanner", "simulationSummary", "recentMediaHighlights",
    "currentDate", "selectedDate",
]
for f in view_fields:
    print(f, f in ws)

banner = (root / "src/components/calendar/SimulationPausedBanner.tsx").read_text(encoding="utf-8")
print("banner wants resolveHref", "resolveHref" in banner)
print("banner wants reason", "reason:" in banner)

# Exact pauseBanner fields from CalendarPageView
svc = (root / "src/application/game-service.ts").read_text(encoding="utf-8")
print("pauseBanner resolveHref", "resolveHref" in svc[svc.find("pauseBanner"):svc.find("pauseBanner")+200])
