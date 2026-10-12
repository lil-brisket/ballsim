from pathlib import Path
pe = Path(r"c:\Users\dynam\Documents\Basketball\src\systems\phase-engine")
# index?
for name in ["index.ts", "index.tsx"]:
    p = pe / name
    print(name, p.exists())
    if p.exists():
        print(p.read_text(encoding="utf-8")[:1500])

# package.json exports?
pkg = pe / "package.json"
print("pkg", pkg.exists())

# How game-service imports phase engine
svc = Path(r"c:\Users\dynam\Documents\Basketball\src\application\game-service.ts").read_text(encoding="utf-8")
for line in svc.splitlines():
    if "phase-engine" in line:
        print(line)
