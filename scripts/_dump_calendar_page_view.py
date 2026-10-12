from pathlib import Path
import re

svc = Path(r"c:\Users\dynam\Documents\Basketball\src\application\game-service.ts").read_text(encoding="utf-8")

# Find CalendarPageMediaHighlight through end of loadCalendarPageView
start = svc.find("export type CalendarPageMediaHighlight")
if start < 0:
    start = svc.find("export type CalendarPageView")
# Find next export async function after loadCalendarPageView
load_start = svc.find("export async function loadCalendarPageView")
# end at next export async function after load_start
next_fn = svc.find("\nexport async function ", load_start + 10)
print("start", start, "load", load_start, "next", next_fn)
print("--- TYPE + OPTIONS ---")
print(svc[start:load_start])
print("--- LOAD FN first 100 lines worth ---")
print(svc[load_start:load_start+5500])
