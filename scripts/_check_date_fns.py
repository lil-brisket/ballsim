from pathlib import Path
import re
cd = Path(r"c:\Users\dynam\Documents\Basketball\src\domain\calendar-date.ts").read_text(encoding="utf-8")
print(re.findall(r"export function (\w+)", cd))
# index.ts current
idx = Path(r"c:\Users\dynam\Documents\Basketball\src\systems\calendar\index.ts").read_text(encoding="utf-8")
print(idx)
