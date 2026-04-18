export interface CameraState {
  targetX: number;
  targetZ: number;
  yaw: number;
  zoom: number;
  height: number;
  tilt: number;
  panVelocityX: number;
  panVelocityZ: number;
  zoomVelocity: number;
  yawVelocity: number;
  fixedTilt: boolean;
  fixedTiltValue: number;
}

export interface CameraConfig {
  heightMin: number;
  heightMax: number;
  tiltAtMaxZoom: number;
  tiltAtMinZoom: number;
  fov: number;
  panSpeed: number;
  panDamping: number;
  zoomSpeed: number;
  zoomDamping: number;
  yawSpeed: number;
  edgeScrollMargin: number;
  edgeScrollSpeed: number;
}

export interface HexPickResult {
  q: number;
  r: number;
  s: number;
  worldX: number;
  worldZ: number;
}

export interface InputIntent {
  panX: number;
  panZ: number;
  yawDelta: number;
  zoomDelta: number;
  dragDeltaX: number;
  isDragging: boolean;
  resetPressed: boolean;
  toggleTiltPressed: boolean;
}
