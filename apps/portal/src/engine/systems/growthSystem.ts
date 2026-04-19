/**
 * @module GrowthSystem
 * @description Engine System: Population growth and decline.
 *
 * This is a "Rule" — it runs automatically at end-of-turn.
 * Actions MUST NOT import or call this directly.
 */

import type { GameState, City } from "../types";
import { getActivePlayer } from "../types";

export function runGrowthSystem(state: GameState): GameState {
  const activePlayer = getActivePlayer(state);
  const logMessages: string[] = [];

  let updatedCities = state.cities.map((city: City) => {
    if (city.owner_id !== activePlayer.player_id) return city;

    const player = state.players.find((p) => p.player_id === city.owner_id);
    if (player && player.treasury.matter >= 10 * city.population) {
      logMessages.push(`${city.name} grew to population ${city.population + 1}!`);
      return { ...city, population: city.population + 1 };
    }
    return city;
  });

  // Plague modifier: -1 population per city
  if (state.globalModifiers["Plague"] === true) {
    updatedCities = updatedCities.map((city: City) => {
      if (city.owner_id !== activePlayer.player_id) return city;
      if (city.population > 1) {
        logMessages.push(`🦠 Plague: ${city.name} lost 1 population.`);
        return { ...city, population: city.population - 1 };
      }
      return city;
    });
  }

  return {
    ...state,
    cities: updatedCities,
    log: [...state.log, ...logMessages],
  };
}
