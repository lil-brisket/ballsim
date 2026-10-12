from pathlib import Path
import re
sb = Path(r"c:\Users\dynam\Documents\Basketball\src\components\ui\StatusBadge.tsx").read_text(encoding="utf-8")
print(re.search(r"export function StatusBadge[\s\S]{0,250}", sb).group(0))
