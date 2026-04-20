export function noise2(x: number, y: number): number {
  return Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1;
}

export function falloff(dist: number): number {
  const t = 1 - Math.min(dist, 1);
  return t * t * (3 - 2 * t);
}

export * from "./bufferMath";
export * from "./hexMath";
