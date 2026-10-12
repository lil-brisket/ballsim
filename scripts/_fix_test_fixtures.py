from pathlib import Path
import re

# Exact CalendarPageView and related props
svc = Path(r"c:\Users\dynam\Documents\Basketball\src\application\game-service.ts").read_text(encoding="utf-8")
print(svc[svc.find("export type CalendarPageView"):svc.find("export type LoadCalendarPageViewOptions")])

print("--- workspace props ---")
ws = Path(r"c:\Users\dynam\Documents\Basketball\src\components\calendar\CalendarWorkspace.tsx").read_text(encoding="utf-8")
print(re.search(r"export function CalendarWorkspace\(props: \{[\s\S]*?\}\) \{", ws).group(0))

print("--- league type ---")
ss = Path(r"c:\Users\dynam\Documents\Basketball\src\state\standings-selectors.ts").read_text(encoding="utf-8")
print(ss[ss.find("export type CalendarLeagueContextView"):ss.find("export type CalendarLeagueContextView")+400])

print("--- simulate test helpers ---")
t = Path(r"c:\Users\dynam\Documents\Basketball\tests\application\simulate-to-date.test.ts").read_text(encoding="utf-8")
print("\n".join(t.splitlines()[:45]))
