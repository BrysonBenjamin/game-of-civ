'use client';
/* eslint-disable react-compiler/react-compiler */

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '@/store/gameStore';
import { DEFAULT_CAMERA_CONFIG, createDefaultCameraState } from '@/game/scene/constants';
import { sampleHeightCurve, sampleTiltCurve } from '@/game/camera/curves';
import type { InputIntent } from '@/game/camera/types';

const FRESH_INTENT = (): InputIntent => ({
  panX: 0,
  panZ: 0,
  yawDelta: 0,
  zoomDelta: 0,
  dragDeltaX: 0,
  isDragging: false,
  resetPressed: false,
  toggleTiltPressed: false,
});

interface InputRefs {
  keys: Set<string>;
  altMouseDown: boolean;
  intent: InputIntent;
}

export function CameraController() {
  const { gl } = useThree();
  const inputRef = useRef<InputRefs>({
    keys: new Set(),
    altMouseDown: false,
    intent: FRESH_INTENT(),
  });

  useEffect(() => {
    const canvas = gl.domElement;
    const inp = inputRef.current;
    const config = DEFAULT_CAMERA_CONFIG;

    const onKeyDown = (e: KeyboardEvent) => {
      inp.keys.add(e.code);
      if (e.code === 'KeyR') inp.intent.resetPressed = true;
      if (e.code === 'KeyT') inp.intent.toggleTiltPressed = true;
    };
    const onKeyUp = (e: KeyboardEvent) => inp.keys.delete(e.code);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      inp.intent.zoomDelta += e.deltaY;
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.altKey) {
        inp.altMouseDown = true;
        inp.intent.isDragging = true;
      }
    };
    const onMouseUp = () => {
      inp.altMouseDown = false;
      inp.intent.isDragging = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (inp.altMouseDown) inp.intent.dragDeltaX += e.movementX;
      const rect = canvas.getBoundingClientRect();
      const m = config.edgeScrollMargin;
      const sp = config.edgeScrollSpeed;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < m) inp.intent.panX -= sp;
      else if (x > rect.width - m) inp.intent.panX += sp;
      if (y < m) inp.intent.panZ -= sp;
      else if (y > rect.height - m) inp.intent.panZ += sp;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
    };
  }, [gl.domElement]);

  useFrame((state, dt) => {
    const config = DEFAULT_CAMERA_CONFIG;
    const inp = inputRef.current;

    // Accumulate held-key intent
    if (inp.keys.has('KeyW') || inp.keys.has('ArrowUp')) inp.intent.panZ -= 1;
    if (inp.keys.has('KeyS') || inp.keys.has('ArrowDown')) inp.intent.panZ += 1;
    if (inp.keys.has('KeyA') || inp.keys.has('ArrowLeft')) inp.intent.panX -= 1;
    if (inp.keys.has('KeyD') || inp.keys.has('ArrowRight')) inp.intent.panX += 1;
    if (inp.keys.has('KeyQ')) inp.intent.yawDelta -= 1;
    if (inp.keys.has('KeyE')) inp.intent.yawDelta += 1;

    const intent = { ...inp.intent };
    inp.intent = FRESH_INTENT();

    // Mutate cameraState directly — no re-render triggered
    const camState = useGameStore.getState().cameraState;
    const clampedDt = Math.min(0.05, dt);
    const dampen = (factor: number) => Math.pow(factor, clampedDt * 60);

    // Zoom
    camState.zoomVelocity += intent.zoomDelta * config.zoomSpeed;
    camState.zoom = Math.max(0, Math.min(1, camState.zoom + camState.zoomVelocity * clampedDt * 60));
    camState.zoomVelocity *= dampen(config.zoomDamping);

    // Height + tilt
    camState.height = sampleHeightCurve(camState.zoom, config);
    camState.tilt = camState.fixedTilt
      ? camState.fixedTiltValue
      : sampleTiltCurve(camState.zoom, config);

    // Yaw
    const yawInput = intent.yawDelta + intent.dragDeltaX * 0.005;
    camState.yawVelocity += yawInput * config.yawSpeed * clampedDt;
    camState.yaw += camState.yawVelocity;
    camState.yawVelocity *= dampen(0.80);

    // Pan (yaw-rotated to prevent control inversion)
    const cosY = Math.cos(camState.yaw);
    const sinY = Math.sin(camState.yaw);
    const rawX = intent.panX * config.panSpeed * clampedDt;
    const rawZ = intent.panZ * config.panSpeed * clampedDt;
    camState.panVelocityX += rawX * cosY + rawZ * sinY;
    camState.panVelocityZ += -rawX * sinY + rawZ * cosY;
    camState.targetX += camState.panVelocityX;
    camState.targetZ += camState.panVelocityZ;
    camState.panVelocityX *= dampen(config.panDamping);
    camState.panVelocityZ *= dampen(config.panDamping);

    if (intent.resetPressed) {
      Object.assign(camState, createDefaultCameraState(config));
    }
    if (intent.toggleTiltPressed) {
      camState.fixedTilt = !camState.fixedTilt;
      camState.fixedTiltValue = camState.tilt;
    }

    // Apply to R3F camera
    const { targetX, targetZ, yaw, height, tilt } = camState;
    const horizRadius = height / Math.tan(tilt);
    state.camera.position.set(
      targetX + horizRadius * Math.sin(yaw),
      height,
      targetZ + horizRadius * Math.cos(yaw),
    );
    state.camera.lookAt(targetX, 0, targetZ);
  });

  return null;
}
