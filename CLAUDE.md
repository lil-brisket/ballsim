@AGENTS.md

# Working with subagents

The `implementer`, `scoper`, `shipper` and `reviewer` agents live in `.claude/agents/`. This is a standing request to use them. Do not wait to be asked.

## Scope unfamiliar tasks with `scoper`

- At the start of a non-trivial task in code you have not read, run `scoper`. Skip it if you expect to read 3 or fewer files you have not already read this session.
- Treat its report as input, not as a decision. It runs on a small model, so open a few of the files it names before building a plan on them. When it flags the task as complex or risky, read the key files yourself.
- You always write the plan.

## Delegate implementation to `implementer`

- Once the task is understood and the solution is clear, hand substantial, well-defined code or test changes to `implementer`: features, bug fixes, refactors, tests.
- Delegate when the change spans several files or you expect more than one edit-and-test cycle. Do it yourself when the change is small and you already know exactly what to write.
- Give it: the goal, acceptance criteria, the files involved, decisions already made, edge cases, and the commands to run. It starts with no context.
- Split work across independent areas (for example separate pages or components) into separate implementer runs. Start dependent slices only after the ones they depend on finish.

## Keep these in the main session

Do not delegate the implementation of changes to any of the following. Decide and write them yourself, or break them into small, fully specified pieces first:

- simulation engine behavior, RNG usage or determinism
- balance numbers and economy, contract, trade or phase-engine rules
- Prisma schema, migrations and persistence mappers
- anything that changes the shape of saved-game data
- cross-layer refactors

## Review every implementer result

Do not trust its summary or its "tests passed". Before reporting a task done:

1. Read the actual `git diff` and the important changed code.
2. Compare it with the plan and acceptance criteria.
3. Check callers and neighboring code for regressions.
4. Confirm the tests cover the changed behavior and were not weakened.
5. Run the broader checks it did not run: `npx tsc --noEmit`, `npm run lint`, `npm run format:check`, `npm test`. Run `npm run test:simulation` and `npm run test:regression` when the change could affect simulation, economy or multi-season behavior.

If you find a real defect, send it back to the same implementer with `SendMessage` so it keeps its context, or fix it yourself if it is small.

This review is the only default review. Run `reviewer` only when the user asks, or for the risky categories above.

## Ship with `shipper`

When the user asks to commit, push or open a PR, hand the git and GitHub steps to `shipper` after your review. Tell it exactly which steps were asked for, which files belong to the change, the issue number if any, and the verification you ran. If it stops on a pre-flight problem, fix it and run it again. Do tiny git operations yourself when a handoff costs more.
