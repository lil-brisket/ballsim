from pathlib import Path
import re
root = Path(r"c:\Users\dynam\Documents\Basketball\src\systems\calendar")
for name in ["project-owner-calendar.ts", "calendar-inspector.ts", "schedule-projection.ts"]:
    text = (root / name).read_text(encoding="utf-8")
    print(name, re.findall(r"export (?:type|function) (\w+)", text))
