from pathlib import Path
import re
ws = Path(r"c:\Users\dynam\Documents\Basketball\src\components\calendar\CalendarWorkspace.tsx").read_text(encoding="utf-8")
print(re.search(r"<SimulationPausedBanner[\s\S]*?/>", ws).group(0))
print("---")
print(re.search(r"<CalendarMonthView[\s\S]*?/>", ws).group(0))
print("---")
print(re.search(r"<CalendarLeagueContextPanel[\s\S]*?/>", ws).group(0))
