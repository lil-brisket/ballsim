from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")
ss = (root / "src/state/standings-selectors.ts").read_text(encoding="utf-8")
# find buildEnriched or similar
for m in re.finditer(r"function \w+", ss):
    print(m.group(0))
print("--- format streak ---")
print(ss[ss.find("function streakLabel") : ss.find("function streakLabel") + 200])
print("--- sort ---")
print(ss[ss.find("function sortStanding") : ss.find("function sortStanding") + 250])
# How games are iterated for next game - schedule gameIds
print("--- schedule type ---")
gs = (root / "src/state/game-state.ts").read_text(encoding="utf-8")
print(gs[gs.find("schedule:") : gs.find("schedule:") + 300] if "schedule:" in gs else "no")
# competition schedule entity
for p in (root / "src/domain/entities").glob("*schedule*"):
    print(p.name)
svc = (root / "src/application/game-service.ts").read_text(encoding="utf-8")
# helpers used in loadCalendarPageView
chunk = svc[svc.find("export async function loadCalendarPageView") : svc.find("export async function loadCalendarPageView") + 5000]
print("--- helpers in load ---")
print(sorted(set(re.findall(r"\b(to\w+|get\w+|find\w+|build\w+|summarize\w+|parse\w+|add\w+)\b", chunk))))
