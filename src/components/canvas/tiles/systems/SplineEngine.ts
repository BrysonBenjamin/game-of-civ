import * as THREE from "three";
import type { Tile } from "@/engine/types";
import type { HexId } from "@/engine/types";
import { axialToWorld } from "../../design/DesignTokens";
import { hexNeighbours } from "@/engine/helpers/hexMath";

// ─── Ridge Splines ────────────────────────────────────────────────────────────

/**
 * Build Catmull-Rom ridge splines through connected chains of mountain tiles.
 * Connected chains are found via flood-fill of adjacency. Each chain becomes
 * one CatmullRomCurve3 thread through sorted hex centers.
 */
export function buildRidgeSplines(map: Record<HexId, Tile>): THREE.CatmullRomCurve3[] {
  const mountainIds = new Set(
    Object.values(map)
      .filter((t) => t.feature === "mountains")
      .map((t) => t.hex_id)
  );

  const visited = new Set<HexId>();
  const splines: THREE.CatmullRomCurve3[] = [];

  for (const startId of mountainIds) {
    if (visited.has(startId)) continue;

    // BFS to find the connected mountain cluster
    const cluster: HexId[] = [];
    const queue = [startId];
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      cluster.push(id);
      for (const nId of hexNeighbours(map[id].coord)) {
        if (mountainIds.has(nId) && !visited.has(nId)) {
          queue.push(nId);
        }
      }
    }

    if (cluster.length < 2) continue;

    // Sort cluster by x then z for a left-to-right spline path
    const points = cluster
      .map((id) => {
        const tile = map[id];
        const [x, , z] = axialToWorld(tile.coord.q, tile.coord.r, 0);
        return new THREE.Vector3(x, 0, z);
      })
      .sort((a, b) => a.x !== b.x ? a.x - b.x : a.z - b.z);

    splines.push(new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5));
  }

  return splines;
}

// ─── River Splines ────────────────────────────────────────────────────────────

// An EdgeId is the canonical string for the shared boundary between two hex tiles
export type EdgeId = `${HexId}|${HexId}`;

export function makeEdgeId(a: HexId, b: HexId): EdgeId {
  return (a < b ? `${a}|${b}` : `${b}|${a}`) as EdgeId;
}

/**
 * Build Catmull-Rom river splines from a set of river edges.
 * Each edge midpoint becomes a spline control point.
 * Connected edge chains are grouped into one spline each.
 */
export function buildRiverSplines(riverEdges: EdgeId[], map: Record<HexId, Tile>): THREE.CatmullRomCurve3[] {
  if (!riverEdges.length) return [];

  // Build adjacency: edge → midpoint + connected edges
  const edgeMidpoints = new Map<EdgeId, THREE.Vector3>();

  for (const edgeId of riverEdges) {
    const [aId, bId] = edgeId.split("|") as [HexId, HexId];
    const a = map[aId];
    const b = map[bId];
    if (!a || !b) continue;

    const [ax, , az] = axialToWorld(a.coord.q, a.coord.r, 0);
    const [bx, , bz] = axialToWorld(b.coord.q, b.coord.r, 0);
    edgeMidpoints.set(edgeId, new THREE.Vector3((ax + bx) / 2, 0.05, (az + bz) / 2));
  }

  // Each isolated group of connected edges forms one spline
  // For now, treat all edges as one river (simple chain, sorted by x)
  if (edgeMidpoints.size === 0) return [];

  const pts = [...edgeMidpoints.values()].sort((a, b) => a.x - b.x);
  if (pts.length < 2) return [];

  return [new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5)];
}
