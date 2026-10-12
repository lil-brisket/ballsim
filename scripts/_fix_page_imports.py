from pathlib import Path
import re
root = Path(r"c:\Users\dynam\Documents\Basketball")

# PageHeader export and path used historically
page_old_imports = """
"""
# find dashboard snapshot controlled team
svc = (root/"src/application/game-service.ts").read_text(encoding="utf-8")
# DashboardSnapshot type
m = re.search(r"export type DashboardSnapshot = \{[\s\S]*?\n\};", svc)
if not m:
    # might be imported
    print("DashboardSnapshot not in game-service")
else:
    print(m.group(0)[:600])

# search controlledTeam across state
for p in (root/"src").rglob("*.ts"):
    t = p.read_text(encoding="utf-8", errors="ignore")
    if "controlledTeam" in t and "DashboardSnapshot" in t:
        print("found", p.relative_to(root))
        idx = t.find("controlledTeam")
        print(t[idx-80:idx+120])
        break

# EmptyState / PageHeader exports
for name in ["PageHeader", "EmptyState"]:
    files = list((root/"src/components").rglob(f"*{name}.tsx"))
    for f in files:
        text = f.read_text(encoding="utf-8")
        print(f.relative_to(root), re.findall(r"export function (\w+)", text)[:5])
