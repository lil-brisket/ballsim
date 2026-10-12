from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")
svc = (root / "src/application/game-service.ts").read_text(encoding="utf-8")
start = svc.find("export type CalendarPageView")
print(svc[start:start+900])
print("--- return keys in load ---")
load = svc[svc.find("export async function loadCalendarPageView"):svc.find("export async function loadCalendarPageView")+4500]
# print return object keys roughly
m = re.search(r"return \{([\s\S]*?)\n  \};\n\}", load)
if m:
    print(m.group(1)[:1200])

# SimulationSummaryModal props
ssm = (root / "src/components/calendar/SimulationSummaryModal.tsx").read_text(encoding="utf-8")
print("--- summary modal props ---")
print(re.search(r"export function SimulationSummaryModal\(props: \{[\s\S]*?\}\)", ssm).group(0)[:800])

# Paused banner props
spb = (root / "src/components/calendar/SimulationPausedBanner.tsx").read_text(encoding="utf-8")
print("--- pause banner ---")
print(re.search(r"export function SimulationPausedBanner\(props: \{[\s\S]*?\}\)", spb).group(0)[:500])

# PageHeader / ErrorState / dashboard
print("--- page header ---")
ph = list((root/"src/components").rglob("*PageHeader*"))
print([p.name for p in ph])
es = list((root/"src/components").rglob("*EmptyState*"))
print([p.name for p in es])
# dashboard controlled team field
print("controlledTeam" in svc, "controlledTeam" in svc)
