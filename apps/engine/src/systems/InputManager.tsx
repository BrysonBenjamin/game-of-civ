import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { worldToAxial } from '@civ/math';
import { HexConstants } from '../constants';

export interface HoveredHex {
  q: number;
  r: number;
}

interface InputManagerProps {
  onHoverHexChange?: (coord: HoveredHex | null) => void;
}

export function InputManager({ onHoverHexChange }: InputManagerProps) {
  const { camera, scene, size, gl } = useThree();
  const lastHoverKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const emitHover = (coord: HoveredHex | null) => {
      const nextKey = coord ? `${coord.q},${coord.r}` : null;
      if (nextKey === lastHoverKeyRef.current) return;

      lastHoverKeyRef.current = nextKey;
      onHoverHexChange?.(coord);

      window.parent.postMessage(
        coord
          ? { type: 'HEX_HOVERED', coord }
          : { type: 'HEX_UNHOVERED' },
        '*',
      );
    };

    const pickGround = (ndcX: number, ndcY: number) => {
      pointer.set(ndcX, ndcY);
      raycaster.setFromCamera(pointer, camera);

      const groundHit = raycaster
        .intersectObjects(scene.children, true)
        .find((hit) => hit.object.userData?.groundPicker);

      if (!groundHit) return null;

      const [q, r] = worldToAxial(
        groundHit.point.x,
        groundHit.point.z,
        HexConstants.SIZE,
      );

      return { q, r, point: groundHit.point };
    };

    const handlePortalMessage = (e: MessageEvent) => {
      if (e.data?.action === 'INPUT_CLICK') {
        const { clientX, clientY } = e.data;
        const x = (clientX / size.width) * 2 - 1;
        const y = -(clientY / size.height) * 2 + 1;

        const hit = pickGround(x, y);
        if (hit) {
          window.parent.postMessage(
            {
              type: 'HEX_CLICKED',
              coord: { q: hit.q, r: hit.r },
              intersectPoint: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
            },
            '*',
          );
        }
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const hit = pickGround(ndcX, ndcY);
      emitHover(hit ? { q: hit.q, r: hit.r } : null);
    };

    const handlePointerLeave = () => {
      emitHover(null);
    };

    window.addEventListener('message', handlePortalMessage);
    gl.domElement.addEventListener('pointermove', handlePointerMove);
    gl.domElement.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      window.removeEventListener('message', handlePortalMessage);
      gl.domElement.removeEventListener('pointermove', handlePointerMove);
      gl.domElement.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [camera, gl, onHoverHexChange, scene, size]);

  return null;
}
