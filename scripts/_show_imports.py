from pathlib import Path

svc_path = Path(r"c:\Users\dynam\Documents\Basketball\src\application\game-service.ts")
text = svc_path.read_text(encoding="utf-8")
lines = text.splitlines()

# Print first 30 lines and calendar import block
print("\n".join(f"{i+1}:{l}" for i,l in enumerate(lines[:30])))
print("---")
for i,l in enumerate(lines):
    if 'from "@/systems/calendar"' in l:
        # print previous 25 lines
        start = max(0, i-25)
        print("\n".join(f"{j+1}:{lines[j]}" for j in range(start, i+1)))
        break
print("---")
for i,l in enumerate(lines):
    if "standings-selectors" in l:
        start = max(0, i-15)
        print("\n".join(f"{j+1}:{lines[j]}" for j in range(start, i+1)))
        break
