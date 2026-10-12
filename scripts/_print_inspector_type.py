from pathlib import Path

insp = Path(r"c:\Users\dynam\Documents\Basketball\src\systems\calendar\calendar-inspector.ts").read_text(encoding="utf-8")
start = insp.find("export type CalendarDateInspectorView")
print(insp[start:start+550])
ss = Path(r"c:\Users\dynam\Documents\Basketball\src\state\standings-selectors.ts").read_text(encoding="utf-8")
start = ss.find("export type CalendarLeagueContextView")
print(ss[start:start+450])
