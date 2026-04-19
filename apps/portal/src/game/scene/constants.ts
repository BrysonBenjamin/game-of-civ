import type { CameraConfig, CameraState } from '@/game/camera/types';
import { sampleHeightCurve, sampleTiltCurve } from '@/game/camera/curves';

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  heightMin: 120,
  heightMax: 600,
  tiltAtMaxZoom: Math.PI / 4,
  tiltAtMinZoom: (55 * Math.PI) / 180,
  fov: 50,
  panSpeed: 80,
  panDamping: 0.85,
  zoomSpeed: 0.003,
  zoomDamping: 0.88,
  yawSpeed: 1.2,
  edgeScrollMargin: 24,
  edgeScrollSpeed: 0.5,
};

export function createDefaultCameraState(config: CameraConfig): CameraState {
  const defaultZoom = 0.5;
  const height = sampleHeightCurve(defaultZoom, config);
  const tilt = sampleTiltCurve(defaultZoom, config);
  return {
    targetX: 0,
    targetZ: 0,
    yaw: 0,
    zoom: defaultZoom,
    height,
    tilt,
    panVelocityX: 0,
    panVelocityZ: 0,
    zoomVelocity: 0,
    yawVelocity: 0,
    fixedTilt: false,
    fixedTiltValue: tilt,
  };
}
