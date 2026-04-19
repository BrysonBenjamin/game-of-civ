# Game of Civ — Architecture & Directory Plan

> This document defines the **current** and **planned** directory structure.
> ✅ = exists today. 🔮 = planned for future.

---

## Current Structure

```
game-of-civ/
├── src/
│   ├── engine/                           ✅ Pure TS — NO React
│   │   ├── types.ts                      ✅ 5-layer GDS schema + GameAction<P>
│   │   ├── stateManager.ts               ✅ Registry-driven command router
│   │   ├── gameLoop.ts                   ✅ Delegates to runSystems()
│   │   │
│   │   ├── 📁 helpers/                   ✅ Global utility library
│   │   │   ├── hexMath.ts                ✅ Hex types + geometry + pathfinding
│   │   │   ├── economy.ts               ✅ Treasury operations
│   │   │   ├── prng.ts                  ✅ Deterministic PRNG (Mulberry32)
│   │   │   └── index.ts                 ✅ Barrel: HexMath, Economy, PRNG
│   │   │
│   │   ├── 📁 actions/                   ✅ One GameAction per mechanic
│   │   │   ├── move.ts                   ✅ Tag-aware movement
│   │   │   ├── foundCity.ts              ✅ Settler → City + territory
│   │   │   ├── attack.ts                ✅ Tag-aware combat + XP
│   │   │   ├── buildImprovement.ts       ✅ Tile improvements
│   │   │   ├── addTag.ts                ✅ Vibe-string mutation
│   │   │   ├── setGlobalModifier.ts      ✅ Global modifier mutation
│   │   │   └── registry.ts              ✅ ActionRegistry + registerAction()
│   │   │
│   │   └── 📁 systems/                   ✅ End-of-turn rules pipeline
│   │       ├── productionSystem.ts       ✅ City yields + modifiers
│   │       ├── growthSystem.ts           ✅ Population + plague
│   │       ├── healingSystem.ts          ✅ Unit HP regen
│   │       └── index.ts                  ✅ runSystems() pipeline
│   │
│   ├── store/                            ✅ Zustand bridge
│   │   └── useGameStore.ts               ✅ State + dispatch + map gen
│   │
│   ├── components/
│   │   ├── 📁 canvas/                    ✅ React Three Fiber
│   │   │   ├── Scene.tsx                 ✅ Canvas + lights + controls
│   │   │   ├── HexGrid.tsx               ✅ Terrain tiles + selection
│   │   │   └── Unit.tsx                  ✅ Placeholder unit meshes
│   │   └── 📁 ui/                        ✅ Tailwind HUD
│   │       ├── HUD.tsx                   ✅ Treasury + unit info + tags
│   │       └── VibeConsole.tsx           ✅ Command log + input
│   │
│   ├── lib/ai/config.ts                  ✅ AI system prompt
│   │
│   └── app/                              ✅ Next.js App Router
│       ├── page.tsx
│       ├── layout.tsx
│       ├── globals.css
│       └── api/ai/route.ts
│
├── README-AI.md                          ✅ AI guardrails (Manifesto)
└── ARCHITECTURE.md                       ✅ This file
```

---

## Planned (Future Scale)

```
src/engine/
├── 📁 types/                    🔮 Split types.ts by layer
├── 📁 actions/
│   ├── research.ts              🔮 Tech tree progression
│   ├── diplomacy.ts             🔮 Deal proposals
│   ├── trade.ts                 🔮 Trade routes
│   ├── produce.ts               🔮 City production queue
│   └── 📁 __tests__/            🔮 Co-located unit tests
├── 📁 systems/
│   ├── visibilitySystem.ts      🔮 Fog-of-war
│   ├── combatSystem.ts          🔮 Auto-resolve combat
│   └── tagResolverSystem.ts     🔮 Pre-process vibe tags
├── 📁 helpers/
│   └── visibility.ts            🔮 Fog-of-war calculation
├── 📁 data/                     🔮 Static balance definitions
│   ├── unitTemplates.ts
│   ├── buildingDefs.ts
│   ├── terrainDefs.ts
│   └── techTree.ts
└── mapGenerator.ts              🔮 Extract from store

src/store/
├── useUIStore.ts                🔮 Camera, selection, panels
└── 📁 middleware/
    └── historyMiddleware.ts     🔮 Undo/redo

src/components/
├── 📁 canvas/
│   ├── HexTile.tsx              🔮 Extract from HexGrid
│   ├── City3D.tsx               🔮 3D city model
│   └── FogOfWar.tsx             🔮 Visibility overlay
└── 📁 ui/
    ├── TechTree.tsx             🔮 Tech tree UI
    ├── DiplomacyPanel.tsx       🔮 Relations matrix
    ├── CityPanel.tsx            🔮 City management
    └── Minimap.tsx              🔮 Minimap overlay

src/lib/
├── 📁 ai/
│   ├── commandParser.ts         🔮 NL → Command mapping
│   └── vibeEngine.ts            🔮 AI tag generation
├── 📁 multiplayer/              🔮 WebSocket/WebRTC
└── 📁 save/                     🔮 Serialization
```
