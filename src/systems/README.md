# Systems

Simulation systems belong here.

Each system should:

- Accept `GameState` (and explicit inputs / `Rng` when stochastic)
- Return `SystemResult` `{ state, events }`
- Avoid importing React, Next.js, or Prisma
- Prefer controlled/immutable state transitions

No simulation systems are implemented in the foundation phase.
