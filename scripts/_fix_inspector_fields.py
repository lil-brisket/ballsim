from pathlib import Path
import re

root = Path(r"c:\Users\dynam\Documents\Basketball")
insp = (root / "src/systems/calendar/calendar-inspector.ts").read_text(encoding="utf-8")
sp = (root / "src/systems/calendar/simulation-preview.ts").read_text(encoding="utf-8")
sch = (root / "src/systems/calendar/schedule-projection.ts").read_text(encoding="utf-8")
cc = (root / "src/systems/simulation/calendar-context.ts").read_text(encoding="utf-8")

your_key = re.search(r"(\w+): SimulationRangeYourTeamPreview", sp).group(1)
sum_fn = re.search(r"export function (summarize\w+)", sp).group(1)
story = re.search(r"(seasonStory|seasonNarrative|seasonStory)\s*:", cc).group(1)
display = re.search(r"(displayLabel|displayLabel)\s*:", cc).group(1)
opp = "opponentName" if "opponentName:" in sch else "opponentName"
phase = "seasonPhase" if "seasonPhase:" in sch else "seasonPhase"

print({
    "your_key": your_key,
    "sum_fn": sum_fn,
    "story": story,
    "display": display,
    "opp": opp,
    "phase": phase,
})

text = insp
text = re.sub(
    r'import \{ summarize\w+ \} from "@/systems/calendar/simulation-preview";',
    f'import {{ {sum_fn} }} from "@/systems/calendar/simulation-preview";',
    text,
)
text = re.sub(r"preview\.(yourTeam|yourTeam)", f"preview.{your_key}", text)
text = re.sub(r"ctx\.(seasonStory|seasonNarrative|seasonStory)", f"ctx.{story}", text)
text = re.sub(r"ctx\.(displayLabel|displayLabel)", f"ctx.{display}", text)
text = re.sub(r"teamGame\.(opponentName|opponentName)", f"teamGame.{opp}", text)
text = re.sub(r"teamGame\.(seasonPhase|seasonPhase)", f"teamGame.{phase}", text)
text = re.sub(r"\bsummarize\w+\(state, selectedDate\)", f"{sum_fn}(state, selectedDate)", text)

(root / "src/systems/calendar/calendar-inspector.ts").write_text(text, encoding="utf-8")
print("done")
for line in text.splitlines():
    if any(x in line for x in ["import { summarize", "preview.", "ctx.", "teamGame.", "summarize"]):
        if "function" not in line or "summarize" in line:
            print(line)
