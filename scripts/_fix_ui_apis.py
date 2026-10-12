from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")
sb = (root / "src/components/ui/StatusBadge.tsx").read_text(encoding="utf-8")
print(sb[:800])
print("---")
act = (root / "src/application/actions.ts").read_text(encoding="utf-8")
print(re.search(r"function returnPath[\s\S]{0,400}", act).group(0))
print("--- styles ---")
st = (root / "src/components/ui/styles.ts").read_text(encoding="utf-8")
print(re.findall(r"export (?:function|const) (\w+)", st)[:20])
print("--- team link ---")
print((root / "src/components/entity/TeamEntityLink.tsx").read_text(encoding="utf-8")[:400])
