import json
from pathlib import Path

d = json.loads(Path("reports/tmp-decade-health.json").read_text(encoding="utf-8"))
out = Path("reports/tmp-decade-health-summary.txt")
lines = []


def p(*a):
    lines.append(" ".join(str(x) for x in a))


s = d["sanity"]
p("=== SANITY ===")
p("HHI", round(s["championshipHhi"], 3))
p("playoffAppearanceRate", round(s["playoffAppearanceRate"], 3))
p("rankPersistence", s["rankPersistence"])
p("bottomToPlayoff", s["bottomToPlayoffRate"])
p("champToNonPlayoff", s["championToNonPlayoffRate"])
p("winPct mean/median/min/max/stdev", round(s["winPct"]["mean"], 3), round(s["winPct"]["median"], 3), round(s["winPct"]["min"], 3), round(s["winPct"]["max"], 3), round(s["winPct"]["stdev"], 3))
p("payroll mean/median/p10/p90 M", round(s["payroll"]["mean"]/1e6,1), round(s["payroll"]["median"]/1e6,1), round(s["payroll"]["p10"]/1e6,1), round(s["payroll"]["p90"]/1e6,1))
p("cash mean/median M", round(s["cash"]["mean"]/1e6,1), round(s["cash"]["median"]/1e6,1))
p("franchiseValue mean/median M", round(s["franchiseValue"]["mean"]/1e6,1), round(s["franchiseValue"]["median"]/1e6,1))
p("meanRosterAge", s["meanRosterAge"])
ten = s["tenure"]
p("distress", ten.get("financialDistressRate"), "insolvency", ten.get("insolvencyRate"), "reloc", ten.get("relocationRate"), "survival", ten.get("survivalThroughSimulation"))
p("WARNINGS")
for w in s["warnings"]:
    p(" ", w["severity"], w["id"], w["message"], json.dumps(w.get("evidence")))
p("REL")
for r in s["relationships"]:
    name = r["name"].encode("ascii", "replace").decode()
    p(" ", name, "r=", r["r"], "diag=", r["diagnostic"])

p()
p("=== SEASONS ===")
for season in d["seasons"]:
    t = season["talent"]
    b = t["ovrBuckets"]
    sd = season["scoringDist"]
    best = season["standings"][0]
    worst = season["standings"][-1]
    p(
        season["year"],
        "champ=",
        season["champion"],
        f"{best['wins']}-{best['losses']}",
        f"..{worst['wins']}-{worst['losses']}",
        "PPG",
        season["regular"]["teamPpg"],
        "FG",
        season["regular"]["fgPct"],
        "3P",
        season["regular"]["threePct"],
        "FT",
        season["regular"]["ftPct"],
        "age",
        t["meanAge"],
        "ovr",
        t["meanOvr"],
        "p90",
        t["p90Ovr"],
        "max",
        t["maxOvr"],
        "90+",
        b["from90"],
        "85-89",
        b["from85to89"],
        "80-84",
        b["from80to84"],
        "inj",
        t["injured"],
        f"{t['injuredPct']}",
        "retired",
        t["retired"],
        "rostered",
        t["rostered"],
        "maxPPG",
        sd["max"],
        "p90PPG",
        sd["p90"],
        "p50PPG",
        sd["p50"],
        "25+",
        sd["seasons25ppg"],
        "30+",
        sd["seasons30ppg"],
    )
    leader = season["scoringLeaders"][0] if season["scoringLeaders"] else None
    if leader:
        p(
            "  leader",
            leader["name"],
            leader["overall"],
            leader["position"],
            f"age{leader['age']}",
            leader["team"],
            f"{leader['ppg']}ppg",
            f"{leader['rpg']}rpg",
            f"{leader['apg']}apg",
            f"{leader['mpg']}mpg",
            f"fg{leader['fgPct']}",
            f"3p{leader['threePct']}",
            f"{leader['games']}gp",
        )
    p("  top5 scorers:")
    for row in season["scoringLeaders"][:5]:
        p(
            f"    {row['ppg']:5.1f} {row['name']:22} ovr{row['overall']:3} {row['position']:2} age{row['age']:2} {row['team']}"
        )
    p("  awards:")
    for a in season["awards"]:
        p(
            f"    {a['awardId']:16} {str(a['winner'])[:28]:28} {a['team']} {a['ppg']}ppg {a['rpg']}rpg {a['apg']}apg ts={a.get('tsPct')} gp={a['games']}"
        )
    p("  standings top5 / bottom3:")
    for row in season["standings"][:5]:
        p(f"    {row['wins']:2}-{row['losses']:<2} ovr{row['meanOvr']:4.1f} {row['ppg']:5.1f}ppg payroll${row['payrollM']}M n={row['rosterSize']} {row['team']}")
    for row in season["standings"][-3:]:
        p(f"    {row['wins']:2}-{row['losses']:<2} ovr{row['meanOvr']:4.1f} {row['ppg']:5.1f}ppg payroll${row['payrollM']}M n={row['rosterSize']} {row['team']}")

p()
p("=== DECADE TEAM WINS ===")
career = {}
for season in d["seasons"]:
    for row in season["standings"]:
        c = career.setdefault(row["team"], {"w": 0, "l": 0, "titles": 0, "payroll": []})
        c["w"] += row["wins"]
        c["l"] += row["losses"]
        c["payroll"].append(row["payrollM"])
    if season["champion"]:
        career[season["champion"]]["titles"] += 1
ranked = sorted(career.items(), key=lambda kv: kv[1]["w"] / (kv[1]["w"] + kv[1]["l"]), reverse=True)
for name, c in ranked:
    gp = c["w"] + c["l"]
    p(f"  {c['w']:4}-{c['l']:<3} {c['w']/gp:.3f} titles={c['titles']} payroll~{sum(c['payroll'])/len(c['payroll']):.0f}M {name}")

p()
p("=== TALENT TREND ===")
p("year rostered 90+ 85-89 80-84 meanOvr p90 max meanAge injured retired")
for season in d["seasons"]:
    t = season["talent"]
    b = t["ovrBuckets"]
    p(season["year"], t["rostered"], b["from90"], b["from85to89"], b["from80to84"], t["meanOvr"], t["p90Ovr"], t["maxOvr"], t["meanAge"], t["injured"], t["retired"])

out.write_text("\n".join(lines), encoding="utf-8")
print("wrote", out, "lines", len(lines))
