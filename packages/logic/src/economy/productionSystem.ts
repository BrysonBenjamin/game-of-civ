/**
 * @module ProductionSystem
 * @description Engine System: Accumulates city yields to player treasury.
 *
 * This is a "Rule" — it runs automatically at end-of-turn.
 * Actions MUST NOT import or call this directly.
 */

import type { GameState } from "../types";
import { getActivePlayer } from "../types";
import * as Economy from "./economyMath";

export function runProductionSystem(state: GameState): GameState {
  const activePlayer = getActivePlayer(state);
  const playerCities = state.cities.filter(
    (c) => c.owner_id === activePlayer.player_id
  );

  if (playerCities.length === 0) return state;

  let totalMatter = 0;
  let totalEnergy = 0;
  let totalData = 0;
  let totalCredits = 0;

  for (const city of playerCities) {
    for (const hexId of city.territory) {
      const tile = state.map[hexId];
      if (tile) {
        totalMatter += tile.yields.matter;
        totalEnergy += tile.yields.energy;
        totalData += tile.yields.data;
        totalCredits += tile.yields.credits;
      }
    }
    // Population generates Data
    totalData += city.population;
    // Population consumes Matter
    totalMatter -= city.population;
  }

  // Apply global modifiers
  if (state.globalModifiers["Nuclear_Winter"] === true) {
    totalEnergy = Math.floor(totalEnergy * 0.5);
  }
  if (state.globalModifiers["Golden_Age"] === true) {
    totalCredits = Math.floor(totalCredits * 1.25);
  }

  const yields = { matter: totalMatter, energy: totalEnergy, data: totalData, credits: totalCredits };

  const updatedPlayers = state.players.map((p) =>
    p.player_id === activePlayer.player_id
      ? Economy.addYield(p, yields)
      : p
  );

  const logMessages: string[] = [];
  if (state.globalModifiers["Nuclear_Winter"] === true) {
    logMessages.push(`☢ Nuclear Winter: -50% Energy yield.`);
  }
  if (state.globalModifiers["Golden_Age"] === true) {
    logMessages.push(`✨ Golden Age: +25% Credits yield.`);
  }

  return {
    ...state,
    players: updatedPlayers,
    log: [...state.log, ...logMessages],
  };
}
