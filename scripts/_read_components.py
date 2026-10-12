from pathlib import Path

# Read current component files for patterns (styles, imports)
root = Path(r"c:\Users\dynam\Documents\Basketball\src\components\calendar")
for name in ["CalendarDayCell.tsx", "CalendarMonthView.tsx", "SimulateUntilPanel.tsx", "SimulationPausedBanner.tsx"]:
    p = root / name
    print("====", name, "====")
    print(p.read_text(encoding="utf-8")[:1200])
    print()
