import * as THREE from "three";
import type { Tile } from "@/engine/types";
import type { HexId } from "@/engine/types";
import { axialToWorld } from "../../design/DesignTokens";
import { hexNeighbours } from "@/engine/helpers/hexMath";
import { type HeightmapResult, sampleHeight } from "./HeightmapSystem";

// ─── PRNG seeded from instance index ─────────────────────────────────────────

function seededRand(seed: number): number {
  const s = (Math.sin(seed * 9301 + 49297) * 233280);
  return s - Math.floor(s);
}

// ─── Clutter rules ───────────────────────────────────────────────────────────

export interface ClutterInstance {
  position: THREE.Vector3;
  rotation: number;    // Y-axis rotation in radians
  scale: number;
}

export interface ClutterBatch {
  kind: "tree" | "reed";
  instances: ClutterInstance[];
}

function tileCenter(tile: Tile): [number, number] {
  const [x, , z] = axialToWorld(tile.coord.q, tile.coord.r, 0);
  return [x, z];
}

function placeTrees(tile: Tile, density: number, seedBase: number): ClutterInstance[] {
  const [cx, cz] = tileCenter(tile);
  const instances: ClutterInstance[] = [];
  // 3–5 hero trees tightly clustered in center, plus 2–3 smaller edge trees
  const heroCount = density >= 1.5 ? 5 : 3;
  const edgeCount = density >= 1.5 ? 3 : 2;
  const total = heroCount + edgeCount;
  for (let i = 0; i < total; i++) {
    const isHero   = i < heroCount;
    const spread   = isHero ? 0.30 : 0.62;
    const angle    = seededRand(seedBase + i * 3)     * Math.PI * 2;
    const radius   = seededRand(seedBase + i * 3 + 1) * spread;
    const rot      = seededRand(seedBase + i * 3 + 2) * Math.PI * 2;
    const scl      = isHero
      ? 0.85 + seededRand(seedBase + i * 3 + 2) * 0.30
      : 0.50 + seededRand(seedBase + i * 3 + 2) * 0.30;
    instances.push({
      position: new THREE.Vector3(cx + Math.cos(angle) * radius, 0, cz + Math.sin(angle) * radius),
      rotation: rot,
      scale: scl,
    });
  }
  return instances;
}

function placeReeds(tile: Tile, seedBase: number): ClutterInstance[] {
  const [cx, cz] = tileCenter(tile);
  const instances: ClutterInstance[] = [];
  for (let i = 0; i < 3; i++) {
    const angle  = seededRand(seedBase + i * 2)     * Math.PI * 2;
    const radius = seededRand(seedBase + i * 2 + 1) * 0.5;
    instances.push({
      position: new THREE.Vector3(cx + Math.cos(angle) * radius, 0, cz + Math.sin(angle) * radius),
      rotation: seededRand(seedBase + i) * Math.PI * 2,
      scale: 0.5 + seededRand(seedBase + i + 7) * 0.5,
    });
  }
  return instances;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Compute clutter batches for all tiles. City adjacency increases tree density
 * to simulate district sprawl. When heightmap is provided, instance Y positions
 * are sampled from the displaced terrain surface.
 */
export function buildClutterBatches(map: Record<HexId, Tile>, heightmap: HeightmapResult | null = null): ClutterBatch[] {
  const tiles = Object.values(map);

  const treeBatch: ClutterInstance[] = [];
  const reedBatch: ClutterInstance[] = [];

  // Pre-index which hexes are adjacent to a city center
  const cityAdjacentIds = new Set<HexId>();
  for (const tile of tiles) {
    if (tile.cityId !== null) {
      for (const nId of hexNeighbours(tile.coord)) {
        cityAdjacentIds.add(nId);
      }
    }
  }

  let seed = 0;
  for (const tile of tiles) {
    seed += 1;
    const feat = tile.feature;

    if (feat === "woods" || feat === "rainforest") {
      const density = cityAdjacentIds.has(tile.hex_id) ? 1.5 : 1.0;
      for (const inst of placeTrees(tile, density, seed * 17)) {
        if (heightmap) {
          inst.position.y = sampleHeight(inst.position.x, inst.position.z, heightmap);
        }
        treeBatch.push(inst);
      }
    }

    if (feat === "marsh") {
      for (const inst of placeReeds(tile, seed * 31)) {
        if (heightmap) {
          inst.position.y = sampleHeight(inst.position.x, inst.position.z, heightmap);
        }
        reedBatch.push(inst);
      }
    }
  }

  const batches: ClutterBatch[] = [];
  if (treeBatch.length) batches.push({ kind: "tree", instances: treeBatch });
  if (reedBatch.length) batches.push({ kind: "reed", instances: reedBatch });
  return batches;
}

// ─── Build InstancedMesh from batch ──────────────────────────────────────────

export function buildInstancedMesh(batch: ClutterBatch): THREE.InstancedMesh {
  const count = batch.instances.length;

  let geo: THREE.BufferGeometry;
  let mat: THREE.Material;

  if (batch.kind === "tree") {
    geo = new THREE.ConeGeometry(0.28, 0.45, 5);
    mat = new THREE.MeshStandardMaterial({ color: "#1e5c1e", flatShading: true, roughness: 0.85 });
  } else {
    geo = new THREE.CylinderGeometry(0.02, 0.04, 0.22, 4);
    mat = new THREE.MeshStandardMaterial({ color: "#5B6A3A", flatShading: true, roughness: 1.0 });
  }

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();

  batch.instances.forEach(({ position, rotation, scale }, i) => {
    dummy.position.copy(position);
    // Lift geometry pivot (cone/cylinder base) above terrain surface
    dummy.position.y += batch.kind === "tree" ? 0.225 : 0.11;
    dummy.rotation.set(0, rotation, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  return mesh;
}
