import type { Tile, BaseTerrainType } from "@civ/types";

export function generateMapBuffer(width: number, height: number, mapData: Record<string, Tile>): Float32Array {
  const buffer = new Float32Array(width * height * 4);
  const terrainMap: Record<BaseTerrainType, number> = {
    plains: 1, grassland: 2, tundra: 3, desert: 4, ocean: 5, snow: 6
  };
  
  let i = 0;
  for (let row = 0; row < height; row++) {
    const q_offset = Math.floor(row / 2);
    for (let col = -q_offset; col < width - q_offset; col++) {
      const q = col;
      const r = row;
      const idx = i * 4;
      const hexId = `${q},${r}`;
      const tile = mapData[hexId];
      
      buffer[idx + 0] = q;
      buffer[idx + 1] = r;
      if (tile) {
        buffer[idx + 2] = terrainMap[tile.baseTerrain] ?? 5; // default to ocean on unknown
        // Cast to any to pluck visibility if injected by portal layer, otherwise assume visible
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buffer[idx + 3] = (tile as any).visibility ?? 1.0; 
      } else {
        buffer[idx + 2] = 5; // ocean boundary fallback
        buffer[idx + 3] = 0.0; // unrevealed
      }
      i++;
    }
  }
  
  return buffer;
}
