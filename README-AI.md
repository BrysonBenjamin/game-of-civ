# AI Maintenance Guardrails — Game of Civ

> **This document is for AI coding agents.** It defines the architectural rules
> that must be followed when making any changes to this codebase.
> Based on the **Civ-Vibe Development Manifesto**.

---

## 1. The Determinism Mandate

Every state transition is a **Pure Function**: `(state, command) => newState`.

- ❌ **`Math.random()` is FORBIDDEN** in `/src/engine/`. Use `helpers/prng.ts` and
  thread `nextSeed` back into `GameState.randomSeed`.
- ❌ **System clocks are FORBIDDEN**. A "Turn" is the only unit of time.
- ✅ All state changes produce a new **immutable snapshot** via spread operators.
  Never mutate the previous state directly.

---

## 2. Engine Purity

The `src/engine/` directory is **pure TypeScript**. No React, no browser APIs.

- ✅ Import engine modules, helpers, systems, and `immer`.
- ❌ **Never** import React, Next.js, or any UI dependency.
- ❌ **Never** import from `src/components/`, `src/store/`, `src/app/`, or `src/lib/`.

---

## 3. Actions vs. Systems

### Actions (Player Verbs) — `/src/engine/actions/`

- Each action exports a **`GameAction<P>`** object with `{ id, validate, perform }`.
- `validate` — pure checks, **no state changes**. Returns `{ valid: true }` or `{ valid: false, reason }`.
- `perform` — returns a **new GameState**. Uses helpers, never raw math.
- One file per mechanic. Register in `actions/registry.ts`.

### Systems (Engine Rules) — `/src/engine/systems/`

- Run automatically at end-of-turn via the `runSystems` pipeline in `systems/index.ts`.
- Actions **MUST NOT** import or call systems directly.
- To add a new system: create the file, add to `SYSTEM_PIPELINE`.

---

## 4. The LLMable Action Template

```ts
/**
 * @file src/engine/actions/MyAction.ts
 * LLM INSTRUCTIONS: Use only types from ../types and helpers from ../helpers.
 */
import type { GameAction, MyCommand } from "../types";
import { HexMath, Economy } from "../helpers";

export const MyAction: GameAction<MyCommand> = {
  id: "MY_COMMAND",
  validate: (state, params) => { /* pure checks */ },
  perform: (state, params) => { /* return new state */ },
};
```

Then register in `actions/registry.ts` and add the command to `types.ts`.

---

## 5. Helper Library — Use It, Don't Rewrite It

| Helper | Functions |
|--------|-----------|
| `HexMath` | `hexKey`, `parseHexKey`, `hexDistance`, `hexNeighbours`, `isAdjacent`, `hexRing`, `hexArea` |
| `Economy` | `canAfford`, `deductCost`, `addYield`, `sumYields`, `scaleYields` |
| `PRNG` | `nextRandom`, `randomInt`, `randomPick` |

If a helper doesn't exist, request that a human developer creates it.

---

## 6. Naming & Style

- **Files:** `camelCase.ts` for modules, `PascalCase.tsx` for React components.
- **Types:** `PascalCase` interfaces, `UPPER_SNAKE_CASE` for constants.
- **No `any`:** Every value must have an explicit type (except registry internals).
- **Discriminated unions:** `{ type: "SOME_ACTION"; ... }` over enums.

---

## 7. Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat(engine): add teleport action
fix(systems): correct growth system matter threshold
refactor(actions): extract combat logic to helpers
```

---

## 8. Vibe-to-Code Workflow

1. **Vibe Input**: User describes a mechanic.
2. **LLM Analysis**: Scan `/engine/types.ts` and `/actions/`.
3. **Code Gen**: Generate `src/engine/actions/NewMechanic.ts` following the template.
4. **Verify**: Run a headless test — deterministic input → expected output.
5. **Merge**: Register in `actions/registry.ts`.

---

## 9. Critical Rules Summary

| Rule | Description |
|------|-------------|
| **Engine Purity** | No React in `/src/engine/` |
| **Determinism** | No `Math.random()`, no clocks |
| **Action Atomicity** | One file per mechanic in `/actions/` |
| **Validate First** | Always `validate()` before `perform()` |
| **Helpers First** | Use `HexMath`/`Economy`/`PRNG`, don't rewrite |
| **Systems Are Sacred** | Actions never modify `gameLoop.ts` or `/systems/` |
| **Immutable State** | Spread operators, never mutate |
