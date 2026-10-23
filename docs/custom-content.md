# Custom roster packages

On **Game setup**, the **Custom roster package** roster source loads a JSON file that defines every team and player in the league. The file is validated in the browser before you create the save, and any errors or warnings are listed under the file picker.

Keep packages fictional. Ballsim does not ship real players or teams, and the gitignored `local-content/` folder exists so personal files never get committed.

The types are in [`src/systems/custom-content/package-types.ts`](../src/systems/custom-content/package-types.ts) and the rules in `validate-roster.ts` and `validate-source-player.ts` next to it. Those files are authoritative if this page and the code disagree.

## Envelope

```json
{
  "formatVersion": 1,
  "type": "roster",
  "contentId": "my-league-v1",
  "metadata": {
    "title": "My League",
    "author": "you",
    "version": "1.0.0",
    "createdAt": "2026-10-23T00:00:00.000Z",
    "updatedAt": "2026-10-23T00:00:00.000Z"
  },
  "compatibility": { "gameStateSchemaVersion": 78, "minSchemaVersion": 78 },
  "payload": { "teams": [], "players": [] }
}
```

- `compatibility` versions must not be newer than `GAME_STATE_SCHEMA_VERSION` in [`src/state/game-state.ts`](../src/state/game-state.ts). Use the current value.
- `metadata.description` is optional.

## Teams

```json
{
  "sourceId": "t1",
  "name": "Comets",
  "city": "Harbor City",
  "abbreviation": "HCC"
}
```

- The number of teams sets the league size and must be a supported team count: 8, 10, 12, 16, 20, 24, 30 or 32 (`SUPPORTED_TEAM_COUNTS` in `src/domain/game-settings.ts`).
- `sourceId` must be unique. `city` and `abbreviation` are optional.

## Players

```json
{
  "sourceId": "p1",
  "teamSourceId": "t1",
  "firstName": "Avery",
  "lastName": "Stone",
  "nationality": "USA",
  "age": 24,
  "heightInches": 78,
  "weightPounds": 210,
  "position": "SF",
  "archetype": "three_and_d_wing",
  "attributes": {
    "speed": 70,
    "strength": 60,
    "athleticism": 72,
    "stamina": 75,
    "finishing": 65,
    "midRange": 62,
    "threePoint": 74,
    "freeThrow": 78,
    "ballHandling": 58,
    "passing": 55,
    "perimeterDefense": 76,
    "interiorDefense": 50,
    "steal": 64,
    "block": 40,
    "rebounding": 52,
    "basketballIq": 66,
    "offensiveIq": 63,
    "defensiveIq": 70,
    "consistency": 65
  },
  "potential": { "overall": 78 },
  "personality": {
    "workEthic": 70,
    "loyalty": 50,
    "competitiveness": 65,
    "leadership": 45,
    "composure": 60
  },
  "durability": 70,
  "contract": { "years": 3, "annualSalary": 12000000 }
}
```

- `teamSourceId` is a team's `sourceId`, or `null` for a free agent.
- Ratings (attributes, potential, personality, durability) are integers from 1 to 99. `age` is 18 to 45.
- `heightInches` must be 68 to 90 and `weightPounds` 160 to 320. A body that is unusual for the player's position only gets a warning (`src/systems/custom-content/body-envelope.ts`).
- `position` is `PG`, `SG`, `SF`, `PF` or `C`. Valid `archetype` and `nationality` values are listed in `src/domain/entities/player-archetype.ts` and `player-nationality.ts`.
- `durability` and `contract` are optional. Without `annualSalary`, the game sets a salary.
- With the salary cap on, a team whose projected payroll is over the cap gets a warning. The package still loads.

There is no export button in the UI yet. `exportRoster` in [`src/systems/custom-content/export.ts`](../src/systems/custom-content/export.ts) shows the shape of a full, valid package.
