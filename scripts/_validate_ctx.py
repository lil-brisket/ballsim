from pathlib import Path
cc = Path(r"c:\Users\dynam\Documents\Basketball\src\systems\simulation\calendar-context.ts").read_text(encoding="utf-8")
start = cc.find("export type CalendarContext")
print(cc[start:start+700])
print("---")
# Check if SaveId is used in ProjectCalendarEventsOptions
pce = Path(r"c:\Users\dynam\Documents\Basketball\src\systems\calendar\project-calendar-events.ts").read_text(encoding="utf-8")
start = pce.find("export type ProjectCalendarEventsOptions")
print(pce[start:start+350])
