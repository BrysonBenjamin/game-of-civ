import * as THREE from 'three';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

export function InputManager() {
  const { camera, scene, size } = useThree();

  useEffect(() => {
    const handlePortalMessage = (e: MessageEvent) => {
      if (e.data?.action === 'INPUT_CLICK') {
        const { clientX, clientY } = e.data;
        const x = (clientX / size.width) * 2 - 1;
        const y = -(clientY / size.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
        
        const intersects = raycaster.intersectObjects(scene.children, true);
        if (intersects.length > 0) {
          // Send Hex ID back to React Portal!
          // Note: Object identity or instanceId logic would derive the exact hex
          window.parent.postMessage({ type: 'HEX_CLICKED', intersectPoint: intersects[0].point }, '*');
        }
      }
    };

    window.addEventListener('message', handlePortalMessage);
    return () => window.removeEventListener('message', handlePortalMessage);
  }, [camera, scene, size]);

  return null;
}
