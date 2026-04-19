/**
 * @module StateManager
 * @description The SOLE entry point for all state transitions.
 *
 * Architecture:
 *   1. Looks up the command in the ActionRegistry.
 *   2. Runs action.validate() — if invalid, logs the reason, returns unchanged state.
 *   3. Runs action.perform() — applies the mutation, returns new state.
 *   4. Records the command in actionHistory (capped at 50).
 *
 * END_TURN is a special meta-action: it runs the Systems pipeline
 * and advances the turn counter. It is NOT in the ActionRegistry.
 *
 * MANIFESTO RULE: This file is RIGID. Actions never modify this file.
 * If an action needs a new variable, add it to types.ts first.
 */

import type { GameState, Command, ActionRecord } from "./types";
import { getActivePlayer } from "./types";
import { getAction } from "./actions/registry";
import { runSystems } from "./systems";

const MAX_HISTORY = 50;

/**
 * Pure state transition function.
 * (state, command) => newState
 */
export function produceNextState(state: GameState, command: Command): GameState {
  // ── END_TURN: meta-action handled separately ──────────────────────
  if (command.type === "END_TURN") {
    return endTurn(recordAction(state, command));
  }

  // ── Player Actions: registry lookup ───────────────────────────────
  const action = getAction(command.type);
  if (!action) {
    return {
      ...state,
      log: [...state.log, `Unknown command: ${command.type}.`],
    };
  }

  // 1. Record
  const withHistory = recordAction(state, command);

  // 2. Validate
  const result = action.validate(withHistory, command);
  if (!result.valid) {
    return {
      ...withHistory,
      log: [...withHistory.log, `${command.type} failed: ${result.reason}`],
    };
  }

  // 3. Perform
  return action.perform(withHistory, command);
}

/** Append a command to actionHistory (capped at MAX_HISTORY). */
function recordAction(state: GameState, command: Command): GameState {
  const activePlayer = getActivePlayer(state);
  const record: ActionRecord = {
    turn: state.turn,
    playerId: activePlayer.player_id,
    command,
  };
  return {
    ...state,
    actionHistory: [...state.actionHistory.slice(-(MAX_HISTORY - 1)), record],
  };
}

/**
 * End the current turn:
 *   1. Run all Systems (production, growth, healing, etc.)
 *   2. Advance to the next player or increment the turn counter.
 *   3. Reset movement for the incoming player's units.
 */
function endTurn(state: GameState): GameState {
  const afterSystems = runSystems(state);

  const nextIdx =
    (afterSystems.activePlayerIndex + 1) % afterSystems.players.length;
  const isNewRound = nextIdx === 0;

  return {
    ...afterSystems,
    turn: isNewRound ? afterSystems.turn + 1 : afterSystems.turn,
    activePlayerIndex: nextIdx,
    units: afterSystems.units.map((u) =>
      u.owner_id === afterSystems.players[nextIdx].player_id
        ? { ...u, movement_remaining: u.max_movement }
        : u
    ),
    log: [
      ...afterSystems.log,
      isNewRound
        ? `── Turn ${afterSystems.turn + 1} ──`
        : `${afterSystems.players[nextIdx].name}'s turn.`,
    ],
  };
}
