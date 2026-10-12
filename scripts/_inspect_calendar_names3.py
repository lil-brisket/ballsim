from pathlib import Path

root = Path(r"c:\Users\dynam\Documents\Basketball")
cc = (root / "src/systems/simulation/calendar-context.ts").read_text(encoding="utf-8")
start = cc.find("export type CalendarContext")
print(cc[start : start + 800])
print("--- importance ---")
es = (root / "src/domain/entities/event-source.ts").read_text(encoding="utf-8")
print(es[:500])
print("--- simulation preview summarize return ---")
sp = (root / "src/systems/calendar/simulation-preview.ts").read_text(encoding="utf-8")
print(sp[:2000])
print("--- team abbreviation field ---")
t = (root / "src/domain/entities/team.ts").read_text(encoding="utf-8")
start = t.find("export type Team =")
print(t[start : start + 400])
print("--- tests list ---")
for p in (root / "tests/systems/calendar").glob("*.ts"):
    print(p.name)
