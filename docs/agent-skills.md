# Agent skills

`.agents/skills/` is the only tracked copy of the agent skills. `skills-lock.json` records where each one came from (currently the nine `prisma/skills` skills).

`.claude/skills/` (Claude Code) and `.windsurf/skills/` (Windsurf) are local mirrors and are gitignored. On a fresh clone, link them to `.agents/skills/` so those tools can see the skills.

PowerShell (Windows; junctions need no admin rights):

```powershell
foreach ($tool in ".claude", ".windsurf") {
  New-Item -ItemType Directory -Force "$tool/skills" | Out-Null
  Get-ChildItem .agents/skills -Directory | ForEach-Object {
    New-Item -ItemType Junction -Path "$tool/skills/$($_.Name)" -Target $_.FullName | Out-Null
  }
}
```

macOS / Linux:

```bash
for tool in .claude .windsurf; do
  mkdir -p "$tool/skills"
  for d in .agents/skills/*/; do ln -sfn "../../$d" "$tool/skills/$(basename "$d")"; done
done
```

To add or update a skill, change `.agents/skills/` and `skills-lock.json` only, then re-run the commands above.
