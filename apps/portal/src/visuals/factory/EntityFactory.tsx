'use client';

import { useGameStore } from '@/store/gameStore';
import { ModularEntity } from '@/components/ModularEntity';
import { getManifest } from '@/visuals/factory/AssetLoader';

export function EntityFactory() {
  const entities = useGameStore((s) => s.entities);

  return (
    <>
      {entities.map((entity) => (
        <ModularEntity
          key={entity.id}
          entity={entity}
          manifest={getManifest(entity.typeId)}
        />
      ))}
    </>
  );
}
