# Phase 5 Regression Matrix

Systems covered across season states. Mark supported only when simulation backs the state.

| System             | Regular Season | Playoffs | Offseason | After Simulation |
| ------------------ | -------------- | -------- | --------- | ---------------- |
| Calendar           | yes            | yes      | yes       | yes              |
| Front Office       | yes            | yes      | yes       | yes              |
| Team               | yes            | yes      | yes       | yes              |
| Roster             | yes            | yes      | yes       | yes              |
| Rotation           | yes            | yes      | yes       | yes              |
| Contracts          | yes            | yes      | yes       | yes              |
| Staff              | yes            | yes      | yes       | yes              |
| Development        | yes            | yes      | yes       | yes              |
| Development League | yes            | yes      | yes       | yes              |
| Finances           | yes            | yes      | yes       | yes              |
| Franchise          | yes            | yes      | yes       | yes              |
| League             | yes            | yes      | yes       | yes              |
| Standings          | yes            | yes      | yes       | yes              |
| Schedule           | yes            | yes      | yes       | yes              |
| Transactions       | yes            | yes      | yes       | yes              |
| Media              | yes            | yes      | yes       | yes              |
| Draft              | inactive       | inactive | yes       | yes              |
| Scouting           | inactive       | inactive | yes       | yes              |
| Free Agency        | inactive       | inactive | yes       | yes              |
| Awards             | yes            | yes      | yes       | yes              |
| Playoffs           | inactive       | yes      | yes       | yes              |
| Offseason Hub      | inactive       | inactive | yes       | yes              |

## Release gate commands

```bash
npx tsc --noEmit
npm run lint
npm test
npm run test:integration
npm run test:regression
```

Phase 5 is not complete if any of these fail, or if critical state-invariant / cross-surface parity / season-rollover tests fail.

Do not suppress, skip, weaken, or delete existing tests to achieve a green suite.
