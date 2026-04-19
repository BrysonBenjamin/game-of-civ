import { create } from 'zustand';
import type { CameraState } from '@/game/camera/types';
import { DEFAULT_CAMERA_CONFIG, createDefaultCameraState } from '@/game/scene/constants';

export interface GameEntity {
  id: string;
  typeId: string;
  hexQ: number;
  hexR: number;
  isSelected: boolean;
}

interface GameStore {
  entities: GameEntity[];
  selectedEntityId: string | null;
  // Mutable camera state — written directly in useFrame, never triggers re-renders
  cameraState: CameraState;

  spawnEntity: (entity: GameEntity) => void;
  selectEntity: (id: string | null) => void;
  moveEntity: (id: string, hexQ: number, hexR: number) => void;
}

export const useGameStore = create<GameStore>()((set) => ({
  entities: [],
  selectedEntityId: null,
  cameraState: createDefaultCameraState(DEFAULT_CAMERA_CONFIG),

  spawnEntity: (entity) =>
    set((s) => ({ entities: [...s.entities, entity] })),

  selectEntity: (id) =>
    set((s) => ({
      selectedEntityId: id,
      entities: s.entities.map((e) => ({ ...e, isSelected: e.id === id })),
    })),

  moveEntity: (id, hexQ, hexR) =>
    set((s) => ({
      entities: s.entities.map((e) =>
        e.id === id ? { ...e, hexQ, hexR } : e,
      ),
    })),
}));
