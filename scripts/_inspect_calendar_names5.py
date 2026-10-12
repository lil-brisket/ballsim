from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")
ce = (root / "src/domain/entities/calendar-event.ts").read_text(encoding="utf-8")
print("calendar-event types:", re.findall(r"export type \w+", ce))
cm = (root / "src/systems/calendar/calendar-month.ts").read_text(encoding="utf-8")
print("month exports:", re.findall(r"export (?:type|function) \w+", cm))
print("month imports project:", re.findall(r"project\w+", cm))
print("CalendarEventView vs CalendarEventView in month:", "CalendarEventView" in cm, "CalendarEventView" in cm)
# Check createEmptyTeamStanding vs createEmptyTeamStanding
ss = (root / "src/state/standings-selectors.ts").read_text(encoding="utf-8")
print("empty standing:", re.findall(r"create\w*Standing\w*", ss)[:5])
print("byTeamId vs byTeamId:", "byTeamId" in ss, "byTeamId" in ss)
print("ownedTeamIds:", re.findall(r"owned\w+", ss)[:5])
print("getActiveOwnerTeamId:", "getActiveOwnerTeamId" in ss)
# standing field names in domain
st = (root / "src/domain/entities/standings.ts").read_text(encoding="utf-8")
print("standing fields:", re.findall(r"^\s+(\w+):", st, re.M))
