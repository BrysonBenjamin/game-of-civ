/**
 * @file src/engine/actions/setGlobalModifier.ts
 * @description Player Action: Set a global modifier on the Meta layer.
 *
 * Global modifiers are "vibe-coded" rules that Systems read to
 * adjust their behaviour (e.g., "Nuclear_Winter" → -50% Energy yield).
 */

import type { GameAction, SetGlobalModifierCommand } from "../types";

export const SetGlobalModifierAction: GameAction<SetGlobalModifierCommand> = {
  id: "SET_GLOBAL_MODIFIER",

  validate: () => {
    // Global modifiers are always valid to set.
    return { valid: true };
  },

  perform: (state, params) => {
    return {
      ...state,
      globalModifiers: { ...state.globalModifiers, [params.key]: params.value },
      log: [...state.log, `Global modifier set: "${params.key}" = ${JSON.stringify(params.value)}.`],
    };
  },
};
