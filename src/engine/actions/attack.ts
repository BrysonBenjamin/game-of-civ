/**
 * @file src/engine/actions/attack.ts
 * @description Player Action: Attack an enemy unit.
 *
 * LLM INSTRUCTIONS: Use HexMath.hexDistance for range checks.
 * Check tags[] for combat modifiers (ranged_attack, fortified, flanking).
 */

import type { GameAction, AttackCommand } from "../types";
import { getActivePlayer } from "../types";
import { HexMath } from "../helpers";

export const AttackAction: GameAction<AttackCommand> = {
  id: "ATTACK",

  validate: (state, params) => {
    const attacker = state.units.find((u) => u.unit_id === params.attacker_id);
    const target = state.units.find((u) => u.unit_id === params.target_id);

    if (!attacker) return { valid: false, reason: `Attacker ${params.attacker_id} not found.` };
    if (!target) return { valid: false, reason: `Target ${params.target_id} not found.` };

    const activePlayer = getActivePlayer(state);
    if (attacker.owner_id !== activePlayer.player_id)
      return { valid: false, reason: `Attacker does not belong to active player.` };
    if (attacker.owner_id === target.owner_id)
      return { valid: false, reason: `Cannot attack own unit.` };

    const attackerCoord = HexMath.parseHexKey(attacker.position);
    const targetCoord = HexMath.parseHexKey(target.position);
    const dist = HexMath.hexDistance(attackerCoord, targetCoord);
    const isRanged = attacker.tags.includes("ranged_attack");
    const maxRange = isRanged ? 2 : 1;

    if (dist > maxRange)
      return { valid: false, reason: `Target out of range (dist=${dist}, range=${maxRange}).` };

    return { valid: true };
  },

  perform: (state, params) => {
    const attackerIdx = state.units.findIndex((u) => u.unit_id === params.attacker_id);
    const targetIdx = state.units.findIndex((u) => u.unit_id === params.target_id);
    const attacker = state.units[attackerIdx];
    const target = state.units[targetIdx];
    const isRanged = attacker.tags.includes("ranged_attack");

    // Tag-based modifiers
    let attackMultiplier = 1;
    let defenseMultiplier = 1;
    if (attacker.tags.includes("flanking")) attackMultiplier += 0.25;
    if (target.tags.includes("fortified")) defenseMultiplier += 0.5;

    const effectiveAttack = attacker.base_strength * attackMultiplier;
    const effectiveDefense = target.base_strength * defenseMultiplier;
    const attackDamage = Math.max(1, Math.round(effectiveAttack - effectiveDefense / 2));
    const retaliateDamage = isRanged
      ? 0
      : Math.max(1, Math.round(effectiveDefense / 2 - effectiveAttack / 4));

    const newTargetHp = target.current_health - attackDamage;
    const newAttackerHp = attacker.current_health - retaliateDamage;
    const xpGain = 5;

    const logMessages: string[] = [
      ...state.log,
      `${attacker.type_id} attacks ${target.type_id} for ${attackDamage} damage.`,
    ];
    if (retaliateDamage > 0) {
      logMessages.push(`${target.type_id} retaliates for ${retaliateDamage} damage.`);
    }

    let updatedUnits = [...state.units];
    const updatedMap = { ...state.map };

    // Resolve target
    if (newTargetHp <= 0) {
      logMessages.push(`${target.type_id} destroyed!`);
      if (updatedMap[target.position]) {
        updatedMap[target.position] = {
          ...updatedMap[target.position],
          unitIds: updatedMap[target.position].unitIds.filter((id) => id !== target.unit_id),
        };
      }
      updatedUnits = updatedUnits.filter((_, i) => i !== targetIdx);
    } else {
      updatedUnits = updatedUnits.map((u, i) =>
        i === targetIdx ? { ...u, current_health: newTargetHp } : u
      );
    }

    // Resolve attacker
    if (newAttackerHp <= 0) {
      logMessages.push(`${attacker.type_id} destroyed in retaliation!`);
      if (updatedMap[attacker.position]) {
        updatedMap[attacker.position] = {
          ...updatedMap[attacker.position],
          unitIds: updatedMap[attacker.position].unitIds.filter((id) => id !== attacker.unit_id),
        };
      }
      updatedUnits = updatedUnits.filter((u) => u.unit_id !== params.attacker_id);
    } else {
      updatedUnits = updatedUnits.map((u) =>
        u.unit_id === params.attacker_id
          ? { ...u, current_health: newAttackerHp, experience_points: u.experience_points + xpGain }
          : u
      );
    }

    return { ...state, units: updatedUnits, map: updatedMap, log: logMessages };
  },
};
