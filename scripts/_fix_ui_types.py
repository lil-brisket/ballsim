from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")

insp = (root / "src/systems/calendar/calendar-inspector.ts").read_text(encoding="utf-8")
print("=== inspector type ===")
print(insp[insp.find("export type CalendarDateInspectorView"):insp.find("export type CalendarDateInspectorView")+700])

ce = (root / "src/domain/entities/calendar-event.ts").read_text(encoding="utf-8")
print("=== event view fields ===")
print(ce[ce.find("export type CalendarEventView"):ce.find("export type CalendarEventView")+500])

# StatusBadge
sb = list((root / "src/components").rglob("*StatusBadge*"))
print("StatusBadge files", [str(p.relative_to(root)) for p in sb])
if sb:
    print(sb[0].read_text(encoding="utf-8")[:500])

# TeamEntityLink
tl = list((root / "src/components").rglob("*TeamEntityLink*"))
print("TeamEntityLink", [str(p.relative_to(root)) for p in tl[:3]])

# styles cn
print("styles exists", (root / "src/components/ui/styles.ts").exists())

# simulateToDateAction fields
act = (root / "src/application/actions.ts").read_text(encoding="utf-8")
start = act.find("export async function simulateToDateAction")
print(act[start:start+600])

# systems/calendar export CalendarDateInspectorView?
idx = (root / "src/systems/calendar/index.ts").read_text(encoding="utf-8")
print("index has inspector", "CalendarDateInspectorView" in idx)

# league context type name
ss = (root / "src/state/standings-selectors.ts").read_text(encoding="utf-8")
print("league type", re.search(r"export type (CalendarLeague\w+)", ss).group(1))
print("streak field", "streakLabel" in ss[ss.find("CalendarLeague"):ss.find("CalendarLeague")+400])
