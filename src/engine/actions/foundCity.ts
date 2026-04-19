/**
 * @file src/engine/actions/foundCity.ts
 * @description Player Action: Convert a SETTLER unit into a new City.
 *
 * LLM INSTRUCTIONS: Use HexMath.hexNeighbours for territory calculation.
 */

import type { GameAction, FoundCityCommand, City, HexId } from "../types";
import { getActivePlayer } from "../types";
import { HexMath } from "../helpers";

let cityCounter = 0;

export const FoundCityAction: GameAction<FoundCityCommand> = {
  id: "FOUND_CITY",

  validate: (state, params) => {
    const unit = state.units.find((u) => u.unit_id === params.unit_id);
    if (!unit) return { valid: false, reason: `Unit ${params.unit_id} not found.` };

    if (unit.type_id !== "SETTLER")
      return { valid: false, reason: `Unit is not a SETTLER.` };

    const activePlayer = getActivePlayer(state);
    if (unit.owner_id !== activePlayer.player_id)
      return { valid: false, reason: `Unit does not belong to active player.` };

    const tile = state.map[unit.position];
    if (!tile) return { valid: false, reason: `Tile not found.` };
    if (tile.cityId !== null) return { valid: false, reason: `Tile already has a city.` };
    if (tile.baseTerrain === "ocean") return { valid: false, reason: `Cannot settle on ocean.` };

    return { valid: true };
  },

  perform: (state, params) => {
    const unitIdx = state.units.findIndex((u) => u.unit_id === params.unit_id);
    const unit = state.units[unitIdx];
    const cityId = `city-${++cityCounter}`;

    const tileCoord = HexMath.parseHexKey(unit.position);
    const neighbourIds = HexMath.hexNeighbours(tileCoord).filter(
      (nId) => state.map[nId] !== undefined
    );
    const territory: HexId[] = [unit.position, ...neighbourIds];

    const newCity: City = {
      city_id: cityId,
      name: params.city_name,
      owner_id: unit.owner_id,
      position: unit.position,
      population: 1,
      production_queue: [],
      territory,
      buildings: [],
    };

    const updatedUnits = state.units.filter((_, i) => i !== unitIdx);
    const updatedMap = { ...state.map };

    updatedMap[unit.position] = {
      ...updatedMap[unit.position],
      unitIds: updatedMap[unit.position].unitIds.filter((id) => id !== unit.unit_id),
      cityId,
      ownerId: unit.owner_id,
    };

    for (const hexId of neighbourIds) {
      if (updatedMap[hexId] && updatedMap[hexId].ownerId === null) {
        updatedMap[hexId] = { ...updatedMap[hexId], ownerId: unit.owner_id };
      }
    }

    const coord = HexMath.parseHexKey(unit.position);
    return {
      ...state,
      units: updatedUnits,
      cities: [...state.cities, newCity],
      map: updatedMap,
      log: [
        ...state.log,
        `City "${params.city_name}" founded at (${coord.q}, ${coord.r}) with ${territory.length} territory tiles.`,
      ],
    };
  },
};
