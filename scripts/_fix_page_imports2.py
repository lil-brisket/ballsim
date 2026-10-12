from pathlib import Path
print(Path(r"c:\Users\dynam\Documents\Basketball\src\components\owner\PageHeader.tsx").read_text(encoding="utf-8")[:300])
print("---")
print(Path(r"c:\Users\dynam\Documents\Basketball\src\components\owner\EmptyState.tsx").read_text(encoding="utf-8")[:400])
print("--- dashboard type ---")
# find DashboardSnapshot definition
for p in Path(r"c:\Users\dynam\Documents\Basketball\src").rglob("*.ts"):
    t = p.read_text(encoding="utf-8", errors="ignore")
    if "export type DashboardSnapshot" in t:
        i = t.find("export type DashboardSnapshot")
        print(p)
        print(t[i:i+500])
        break
