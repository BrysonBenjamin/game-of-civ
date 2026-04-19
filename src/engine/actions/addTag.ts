/**
 * @file src/engine/actions/addTag.ts
 * @description Player Action: Append a vibe-string tag to a unit.
 *
 * This is the core hook for "vibe-coding." Tags are read by
 * action validators and perform functions to apply dynamic modifiers.
 *
 * LLM INSTRUCTIONS: This action is the simplest template. Use it as
 * a reference when generating new actions.
 */

import type { GameAction, AddTagCommand } from "../types";

export const AddTagAction: GameAction<AddTagCommand> = {
  id: "ADD_TAG",

  validate: (state, params) => {
    const unit = state.units.find((u) => u.unit_id === params.unit_id);
    if (!unit) return { valid: false, reason: `Unit ${params.unit_id} not found.` };
    if (unit.tags.includes(params.tag))
      return { valid: false, reason: `Unit already has tag "${params.tag}".` };
    return { valid: true };
  },

  perform: (state, params) => {
    const unit = state.units.find((u) => u.unit_id === params.unit_id)!;
    return {
      ...state,
      units: state.units.map((u) =>
        u.unit_id === params.unit_id
          ? { ...u, tags: [...u.tags, params.tag] }
          : u
      ),
      log: [...state.log, `Tag "${params.tag}" added to ${unit.type_id} (${unit.unit_id}).`],
    };
  },
};
