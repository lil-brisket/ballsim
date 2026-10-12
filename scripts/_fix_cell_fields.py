from pathlib import Path
import re
sch = Path(r"c:\Users\dynam\Documents\Basketball\src\systems\calendar\schedule-projection.ts").read_text(encoding="utf-8")
print(sch[sch.find("export type TeamCalendarGameView"):sch.find("export type TeamCalendarGameView")+450])
cm = Path(r"c:\Users\dynam\Documents\Basketball\src\systems\calendar\calendar-month.ts").read_text(encoding="utf-8")
print("cell fields:", re.findall(r"^\s+(\w+)[?:]?", cm[cm.find("export type CalendarDayCell"):cm.find("export type CalendarDayCell")+500], re.M))
print("grid type:", re.search(r"export type (CalendarMonth\w+)", cm).group(1))
