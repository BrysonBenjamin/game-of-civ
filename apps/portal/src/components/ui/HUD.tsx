"use client";

import { useGameStore } from "@/store/useGameStore";
import { getActivePlayer } from "@civ/logic";
import { Swords, Atom, Zap, Database, Coins, RotateCcw, Tag } from "lucide-react";

export default function HUD() {
  const state = useGameStore((s) => s.state);
  const selectedUnitId = useGameStore((s) => s.selectedUnitId);
  const dispatch = useGameStore((s) => s.dispatch);
  const resetGame = useGameStore((s) => s.resetGame);

  const activePlayer = getActivePlayer(state);
  const selectedUnit = selectedUnitId
    ? state.units.find((u) => u.unit_id === selectedUnitId)
    : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="pointer-events-auto flex items-center justify-between gap-4">
        {/* Turn + phase — Cinzel serif heading */}
        <div className="flex items-center gap-3 rounded-xl px-5 py-3 text-white backdrop-blur-md"
          style={{ background: "rgba(44, 26, 14, 0.80)", border: "1px solid rgba(201, 162, 39, 0.30)" }}
        >
          <Swords className="h-5 w-5" style={{ color: "#C9A227" }} />
          <span
            className="text-sm font-bold tracking-widest uppercase"
            style={{ fontFamily: "var(--font-cinzel)", color: "#F5E6C8" }}
          >
            Turn {state.turn}
          </span>
          <span className="text-xs uppercase tracking-wider" style={{ color: "rgba(212, 196, 154, 0.60)" }}>
            {state.phase}
          </span>
        </div>

        {/* Active player treasury */}
        <div
          className="flex items-center gap-4 rounded-xl px-5 py-3 backdrop-blur-md"
          style={{ background: "rgba(44, 26, 14, 0.80)", border: "1px solid rgba(201, 162, 39, 0.30)" }}
        >
          <span
            className="text-sm font-bold tracking-widest"
            style={{ fontFamily: "var(--font-cinzel)", color: activePlayer.color }}
          >
            {activePlayer.name}
          </span>
          <div className="flex items-center gap-1 text-xs" style={{ color: "#5A9A50" }}>
            <Atom className="h-3.5 w-3.5" />
            {activePlayer.treasury.matter}
          </div>
          <div className="flex items-center gap-1 text-xs" style={{ color: "#C08020" }}>
            <Zap className="h-3.5 w-3.5" />
            {activePlayer.treasury.energy}
          </div>
          <div className="flex items-center gap-1 text-xs" style={{ color: "#4A8AAA" }}>
            <Database className="h-3.5 w-3.5" />
            {activePlayer.treasury.data}
          </div>
          <div className="flex items-center gap-1 text-xs" style={{ color: "#C9A227" }}>
            <Coins className="h-3.5 w-3.5" />
            {activePlayer.treasury.credits}
          </div>
        </div>

        {/* Reset */}
        <button
          onClick={resetGame}
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs backdrop-blur-md transition hover:opacity-80"
          style={{ background: "rgba(44, 26, 14, 0.70)", border: "1px solid rgba(201, 162, 39, 0.25)", color: "#D4C49A" }}
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────────── */}
      <div className="pointer-events-auto flex items-end justify-between gap-4">
        {/* Selected unit info */}
        {selectedUnit && (
          <div
            className="rounded-xl px-5 py-3 backdrop-blur-md"
            style={{ background: "rgba(44, 26, 14, 0.85)", border: "1px solid rgba(201, 162, 39, 0.30)" }}
          >
            <p
              className="text-xs uppercase tracking-widest"
              style={{ color: "rgba(212, 196, 154, 0.55)" }}
            >
              Selected Unit
            </p>
            <p
              className="mt-1 text-sm font-bold"
              style={{ fontFamily: "var(--font-cinzel)", color: "#F5E6C8" }}
            >
              {selectedUnit.type_id}
            </p>
            <p className="text-xs" style={{ color: "#D4C49A" }}>
              HP: {selectedUnit.current_health}/{selectedUnit.max_health} ·
              Moves: {selectedUnit.movement_remaining}/{selectedUnit.max_movement} ·
              STR: {selectedUnit.base_strength} ·
              XP: {selectedUnit.experience_points}
            </p>
            {selectedUnit.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {selectedUnit.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
                    style={{ background: "rgba(201, 162, 39, 0.20)", color: "#C9A227", border: "1px solid rgba(201, 162, 39, 0.35)" }}
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* End Turn */}
        <button
          onClick={() => dispatch({ type: "END_TURN" })}
          className="ml-auto rounded-xl px-6 py-3 text-sm font-bold shadow-lg transition hover:scale-105 active:scale-95"
          style={{
            fontFamily: "var(--font-cinzel)",
            background: "linear-gradient(135deg, #C9A227 0%, #8B5A10 100%)",
            color: "#F5E6C8",
            letterSpacing: "0.1em",
          }}
        >
          End Turn
        </button>
      </div>
    </div>
  );
}
