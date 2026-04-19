import warriorConfig from '@/visuals/registry/warrior/config.json';

export interface VisualManifest {
  id: string;
  modelPath: string;
  baseScale: number;
  yOffset: number;
  selectionColor: string;
  animations: {
    idle: string;
    move: string;
    action: string;
  };
  glowIntensity: number;
}

export const VISUAL_REGISTRY: Record<string, VisualManifest> = {
  WARRIOR: warriorConfig as VisualManifest,
};

export const FALLBACK_MANIFEST: VisualManifest = {
  id: 'UNKNOWN',
  modelPath: '',
  baseScale: 1.0,
  yOffset: 4,
  selectionColor: '#FFB81C',
  animations: { idle: 'idle', move: 'walk', action: 'attack' },
  glowIntensity: 0.8,
};

export function getManifest(typeId: string): VisualManifest {
  return VISUAL_REGISTRY[typeId] ?? FALLBACK_MANIFEST;
}
