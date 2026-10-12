from pathlib import Path
g = Path(r"c:\Users\dynam\Documents\Basketball\src\domain\entities\game.ts").read_text(encoding="utf-8")
idx = g.find("export type Game")
print("idx", idx)
print(repr(g[idx:idx+600]))
