from pathlib import Path
ss = Path(r"c:\Users\dynam\Documents\Basketball\src\state\standings-selectors.ts").read_text(encoding="utf-8")
print(ss[-800:])
print("--- sort fn name ---")
import re
print(re.findall(r"function (sort\w+|streak\w+|gamesBack)", ss))
print("standing access:", "byTeamId" in ss, "standings.byTeamId" in ss)
# how standings stored
print(re.findall(r"standings\.\w+", ss)[:10])
