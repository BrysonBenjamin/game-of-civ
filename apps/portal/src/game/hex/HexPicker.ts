import * as THREE from 'three';
import type { HexPickResult } from '@/game/camera/types';
import { hexToWorld, HEX_SIZE } from './types';

export class HexPicker {
  private raycaster = new THREE.Raycaster();

  pick(
    ndc: THREE.Vector2,
    camera: THREE.PerspectiveCamera,
    gridMesh: THREE.InstancedMesh,
  ): HexPickResult | null {
    this.raycaster.setFromCamera(ndc, camera);
    const hits = this.raycaster.intersectObject(gridMesh);
    if (!hits.length) return null;
    const { x, z } = hits[0].point;
    return worldToNearestHex(x, z);
  }
}

function worldToNearestHex(wx: number, wz: number): HexPickResult {
  const q = ((Math.sqrt(3) / 3) * wx - (1 / 3) * wz) / HEX_SIZE;
  const r = ((2 / 3) * wz) / HEX_SIZE;
  return cubeRound(q, r);
}

function cubeRound(fq: number, fr: number): HexPickResult {
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  let s = Math.round(fs);

  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);

  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  // s is always derived: s = -q - r

  const { x: worldX, z: worldZ } = hexToWorld(q, r);
  return { q, r, s: -q - r, worldX, worldZ };
}
