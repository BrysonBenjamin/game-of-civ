import type { CameraConfig } from './types';

export function sampleHeightCurve(zoom: number, config: CameraConfig): number {
  const t = Math.max(0, Math.min(1, zoom));
  return config.heightMin + (config.heightMax - config.heightMin) * (t * t);
}

export function sampleTiltCurve(zoom: number, config: CameraConfig): number {
  const t = Math.max(0, Math.min(1, zoom));
  return config.tiltAtMaxZoom + (config.tiltAtMinZoom - config.tiltAtMaxZoom) * t;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
