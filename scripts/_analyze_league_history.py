import json
import statistics
import collections
from pathlib import Path

p = Path("tests/fixtures/league-history.json")
data = json.loads(p.read_text(encoding="utf-8"))
teams = {t["id"]: f"{t['city']} {t['name']}" for t in data["teams"]}
print("META", json.dumps(data["meta"]))
print("TEAMS", len(teams))
print("SEASONS", len(data["seasons"]))
print()

champs = []
rows = []
award_rows = []
for s in data["seasons"]:
    year = s["seasonYear"]
    st = s["standings"]
    wins = [r["wins"] for r in st]
    ppg = [r["pointsFor"] / (r["wins"] + r["losses"]) for r in st]
    diffs = [r["pointDifferential"] for r in st]
    champ_id = s["playoffs"]["championTeamId"]
    champ = teams.get(champ_id, champ_id)
    champs.append(champ)
    best = max(st, key=lambda r: (r["wins"], r["pointDifferential"]))
    worst = min(st, key=lambda r: (r["wins"], r["pointDifferential"]))
    print(
        f"{year} champ={champ:28} best={best['wins']}-{best['losses']} "
        f"worst={worst['wins']}-{worst['losses']} "
        f"meanPPG={sum(ppg)/len(ppg):.1f} spreadW={max(wins)-min(wins)} "
        f"stdW={statistics.pstdev(wins):.1f}"
    )
    yearly = [a for a in s["awards"] if a.get("cadence") == "yearly"]
    for a in yearly:
        snap = a.get("context", {}).get("statSnapshot", {})
        pg = snap.get("perGame", {})
        award_rows.append(
            {
                "year": year,
                "award": a["awardId"],
                "ppg": pg.get("points"),
                "rpg": pg.get("rebounds"),
                "apg": pg.get("assists"),
                "mpg": pg.get("minutes"),
                "ts": (snap.get("efficiency") or {}).get("tsPct"),
                "efg": (snap.get("efficiency") or {}).get("eFgPct"),
                "games": snap.get("games"),
                "teamWins": (snap.get("teamRecord") or {}).get("wins"),
            }
        )
    rows.append(
        {
            "year": year,
            "champ": champ,
            "bestW": best["wins"],
            "bestL": best["losses"],
            "worstW": worst["wins"],
            "worstL": worst["losses"],
            "meanPpg": sum(ppg) / len(ppg),
            "minPpg": min(ppg),
            "maxPpg": max(ppg),
            "stdWins": statistics.pstdev(wins),
            "winSpread": max(wins) - min(wins),
            "teams": [
                {
                    "name": teams[r["teamId"]],
                    "w": r["wins"],
                    "l": r["losses"],
                    "ppg": r["pointsFor"] / (r["wins"] + r["losses"]),
                    "diff": r["pointDifferential"],
                }
                for r in st
            ],
        }
    )

print()
print("UNIQUE CHAMPS", len(set(champs)), "/", len(champs))
c = collections.Counter(champs)
for name, n in c.most_common():
    print(f"  {n} {name}")
print()
print("SCORING mean team PPG by season:")
for r in rows:
    print(
        f"  {r['year']} {r['meanPpg']:.1f} (team range {r['minPpg']:.1f}-{r['maxPpg']:.1f})"
    )
print("DECADE mean team PPG", sum(r["meanPpg"] for r in rows) / len(rows))
print()
print("AWARDS yearly:")
by_award = collections.defaultdict(list)
for a in award_rows:
    by_award[a["award"]].append(a)
    if a["award"] in (
        "mvp",
        "dpoy",
        "roy",
        "sixth_man",
        "most_improved",
        "coach_of_year",
    ):
        extra = ""
        if a["ppg"] is not None:
            ts = (a["ts"] or 0) * 100
            extra = (
                f" {a['ppg']:.1f}ppg {(a.get('rpg') or 0):.1f}rpg "
                f"{(a.get('apg') or 0):.1f}apg ts={ts:.1f}% gp={a['games']} "
                f"teamW={a['teamWins']}"
            )
        print(f"  {a['year']} {a['award']:16}{extra}")

print()
mvps = by_award["mvp"]
ppgs = [a["ppg"] for a in mvps if a["ppg"] is not None]
print(
    "MVP PPG min/mean/max",
    f"{min(ppgs):.1f} / {sum(ppgs)/len(ppgs):.1f} / {max(ppgs):.1f}",
)
print("ROY PPG", [round(a["ppg"], 1) for a in by_award["roy"]])
print(
    "DPOY PPG/RPG",
    [(round(a["ppg"], 1), round(a["rpg"], 1)) for a in by_award["dpoy"]],
)

career = collections.defaultdict(lambda: {"w": 0, "l": 0, "titles": 0})
for r in rows:
    for t in r["teams"]:
        career[t["name"]]["w"] += t["w"]
        career[t["name"]]["l"] += t["l"]
    career[r["champ"]]["titles"] += 1

print()
print("DECADE RECORDS")
ranked = sorted(
    career.items(),
    key=lambda kv: kv[1]["w"] / (kv[1]["w"] + kv[1]["l"]),
    reverse=True,
)
for name, d in ranked:
    gp = d["w"] + d["l"]
    print(f"  {d['w']:4}-{d['l']:<3} {d['w']/gp:.3f} titles={d['titles']} {name}")

n = len(champs)
hhi = sum((c[name] / n) ** 2 for name in c)
print()
print("Championship HHI", round(hhi, 3), "(equal share", round(1 / len(c), 3), ")")
print("Best records >=70", sum(1 for r in rows if r["bestW"] >= 70))
print("Worst records <=20", sum(1 for r in rows if r["worstW"] <= 20))
print("Win stdev mean", sum(r["stdWins"] for r in rows) / len(rows))

# Repeat champions consecutive
print()
print("CHAMPION SEQUENCE")
print(" -> ".join(champs))
