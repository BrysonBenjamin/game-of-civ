"use client";

/**
 * @module CameraRig
 * @description Civ VI-style strategic camera.
 *
 * Hierarchy:  Pivot (pan + yaw) → Arm (pitch + altitude) → Camera
 *
 * Controls:
 *   WASD / Arrows — yaw-normalised panning
 *   Q / E         — orbital yaw rotation
 *   Scroll wheel  — zoom (tactical ↔ strategic)
 *   Right-drag    — free orbital yaw
 *   Mouse edge    — edge-scroll panning
 */

import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── Config ──────────────────────────────────────────────────────────────────

export interface CameraConfig {
  altMin:      number;   // world-Y at zoom=0 (tactical)
  altMax:      number;   // world-Y at zoom=1 (strategic)
  pitchMin:    number;   // elevation angle in degrees at zoom=0
  pitchMax:    number;   // elevation angle in degrees at zoom=1
  panSpeed:    number;   // world units/sec base pan speed
  rotSpeed:    number;   // rad/sec yaw rotation speed
  zoomStep:    number;   // zoom delta per scroll pixel
  zoomDamp:    number;   // lerp factor for zoom smoothing
  edgeZone:    number;   // fraction of canvas width/height for edge scroll
  edgeSpeed:   number;   // multiplier applied on top of panSpeed for edges
  mapMinX:     number;
  mapMaxX:     number;
  mapMinZ:     number;
  mapMaxZ:     number;
  initPivotX:  number;
  initPivotZ:  number;
  initYaw:     number;   // radians
  initZoom:    number;   // 0–1
  fov:         number;
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  altMin:     3,
  altMax:     22,
  pitchMin:   38,      // gentle tilt when zoomed in
  pitchMax:   72,      // near top-down when zoomed out
  panSpeed:   6,
  rotSpeed:   1.4,
  zoomStep:   0.0008,
  zoomDamp:   9,
  edgeZone:   0.05,
  edgeSpeed:  0.5,
  mapMinX:    -2,
  mapMaxX:    16,
  mapMinZ:    -2,
  mapMaxZ:    26,
  initPivotX: 6.75,
  initPivotZ: 11.7,
  initYaw:    0,
  initZoom:   0.62,
  fov:        45,
};

// ─── Curve helpers ────────────────────────────────────────────────────────────

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function zoomToAlt(z: number, cfg: CameraConfig): number {
  return cfg.altMin + smoothstep(z) * (cfg.altMax - cfg.altMin);
}

function zoomToPitch(z: number, cfg: CameraConfig): number {
  const deg = cfg.pitchMin + smoothstep(z) * (cfg.pitchMax - cfg.pitchMin);
  return deg * (Math.PI / 180);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface CameraRigProps {
  config?: Partial<CameraConfig>;
}

export default function CameraRig({ config: overrides = {} }: CameraRigProps) {
  const cfg = { ...DEFAULT_CAMERA_CONFIG, ...overrides };
  const { camera, gl } = useThree();

  // All mutable camera state in a single ref to avoid re-renders
  const s = useRef({
    pivotX:      cfg.initPivotX,
    pivotZ:      cfg.initPivotZ,
    yaw:         cfg.initYaw,
    zoom:        cfg.initZoom,
    targetZoom:  cfg.initZoom,
    keys:        new Set<string>(),
    edgePanX:    0,    // -1, 0, or 1
    edgePanZ:    0,
    dragging:    false,
    lastMouseX:  0,
    initialized: false,
  });

  // Set up event listeners once on mount
  useEffect(() => {
    const st = s.current;
    const canvas = gl.domElement;

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't steal focus from text inputs
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      st.keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => st.keys.delete(e.code);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      st.targetZoom = Math.max(0, Math.min(1, st.targetZoom + e.deltaY * cfg.zoomStep));
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top)  / rect.height;
      const ez = cfg.edgeZone;

      st.edgePanX = nx < ez ? -1 : nx > 1 - ez ? 1 : 0;
      st.edgePanZ = ny < ez ? -1 : ny > 1 - ez ? 1 : 0;

      if (st.dragging) {
        const dx = e.clientX - st.lastMouseX;
        st.yaw    += dx * 0.005;
        st.lastMouseX = e.clientX;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        st.dragging   = true;
        st.lastMouseX = e.clientX;
      }
    };
    const onMouseUp       = () => { st.dragging = false; };
    const onContextMenu   = (e: Event) => e.preventDefault();

    window.addEventListener("keydown",   onKeyDown);
    window.addEventListener("keyup",     onKeyUp);
    canvas.addEventListener("wheel",     onWheel, { passive: false });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup",   onMouseUp);
    canvas.addEventListener("contextmenu", onContextMenu);

    return () => {
      window.removeEventListener("keydown",   onKeyDown);
      window.removeEventListener("keyup",     onKeyUp);
      canvas.removeEventListener("wheel",     onWheel);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup",   onMouseUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [gl, cfg.zoomStep, cfg.edgeZone]);

  useFrame((_, rawDt) => {
    const st  = s.current;
    const dt  = Math.min(rawDt, 0.1);   // cap at 100ms to survive tab-switch spikes
    const keys = st.keys;

    // ── Zoom smoothing ────────────────────────────────────────────────────
    st.zoom += (st.targetZoom - st.zoom) * Math.min(1, cfg.zoomDamp * dt);

    const altitude  = zoomToAlt(st.zoom, cfg);
    const pitchRad  = zoomToPitch(st.zoom, cfg);

    // ── Pan input (yaw-normalised) ────────────────────────────────────────
    let fwd   = 0;
    let right = 0;

    if (keys.has("KeyW") || keys.has("ArrowUp"))    fwd   +=  1;
    if (keys.has("KeyS") || keys.has("ArrowDown"))  fwd   += -1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) right +=  1;
    if (keys.has("KeyA") || keys.has("ArrowLeft"))  right += -1;

    // Edge scrolling (fraction of pan speed)
    fwd   -= st.edgePanZ * cfg.edgeSpeed;
    right += st.edgePanX * cfg.edgeSpeed;

    if (fwd !== 0 || right !== 0) {
      // Pan speed scales mildly with altitude so strategic view moves faster
      const speed  = (cfg.panSpeed + altitude * 0.4) * dt;
      const sinY   = Math.sin(st.yaw);
      const cosY   = Math.cos(st.yaw);
      // Yaw-normalised: forward = (sinY, 0, cosY), right = (cosY, 0, -sinY)
      st.pivotX += (sinY * fwd + cosY * right) * speed;
      st.pivotZ += (cosY * fwd - sinY * right) * speed;
    }

    // ── Yaw rotation (Q/E keys) ───────────────────────────────────────────
    if (keys.has("KeyQ")) st.yaw -= cfg.rotSpeed * dt;
    if (keys.has("KeyE")) st.yaw += cfg.rotSpeed * dt;

    // ── Clamp pivot to map bounds ─────────────────────────────────────────
    st.pivotX = Math.max(cfg.mapMinX, Math.min(cfg.mapMaxX, st.pivotX));
    st.pivotZ = Math.max(cfg.mapMinZ, Math.min(cfg.mapMaxZ, st.pivotZ));

    // ── Compute camera world position from pivot + arm ────────────────────
    //   arm extends backward (−forward) by (altitude / tan(pitch)) at height altitude
    const backDist = altitude / Math.tan(pitchRad);
    const sinY     = Math.sin(st.yaw);
    const cosY     = Math.cos(st.yaw);

    camera.position.set(
      st.pivotX - sinY * backDist,
      altitude,
      st.pivotZ - cosY * backDist,
    );
    camera.lookAt(st.pivotX, 0, st.pivotZ);

    // ── Dynamic near/far clipping planes ─────────────────────────────────
    const cam = camera as THREE.PerspectiveCamera;
    cam.near  = Math.max(0.05, altitude * 0.05);
    cam.far   = altitude * 12 + 150;
    if (!st.initialized || Math.abs(cam.fov - cfg.fov) > 0.01) {
      cam.fov  = cfg.fov;
      st.initialized = true;
    }
    cam.updateProjectionMatrix();
  });

  return null;
}
