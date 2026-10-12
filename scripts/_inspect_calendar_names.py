from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")

g = (root / "src/domain/entities/game.ts").read_text(encoding="utf-8")
snippet = g[g.find("export type Game =") : g.find("export type Game =") + 700]
print("game fields:", re.findall(r"(home|away|competition|status|score)\w*", snippet))
print("GameStatus:", g[g.find("export type GameStatus") : g.find("export type GameStatus") + 90])
print(
    "CompetitionType:",
    g[g.find("export type GameCompetitionType") : g.find("export type GameCompetitionType") + 140],
)

gs = (root / "src/state/game-state.ts").read_text(encoding="utf-8")
print("active fields:", sorted(set(re.findall(r"active\w+", gs))))

ss = (root / "src/state/standings-selectors.ts").read_text(encoding="utf-8")
print(
    "rank fields:",
    sorted(set(re.findall(r"\w*Rank\w*|\w*gamesBack\w*|streak\w*|conferenceWins|divisionWins", ss)))[:40],
)

page = (root / "src/app/dashboard/[saveId]/calendar/page.tsx").read_text(encoding="utf-8")
print("---PAGE HEAD---")
print("\n".join(page.splitlines()[:25]))

ws = (root / "src/components/calendar/CalendarWorkspace.tsx").read_text(encoding="utf-8")
print("---WS HEAD---")
print("\n".join(ws.splitlines()[:30]))

act = (root / "src/application/actions.ts").read_text(encoding="utf-8")
print(
    "simulate actions:",
    re.findall(r"export async function (simulate\w+|advance\w+)", act)[:25],
)

# CalendarPageView exact
svc = (root / "src/application/game-service.ts").read_text(encoding="utf-8")
start = svc.find("export type CalendarPageView")
end = svc.find("export type LoadCalendarPageViewOptions")
print("---CalendarPageView---")
print(svc[start:end])
