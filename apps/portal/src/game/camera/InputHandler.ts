import type { CameraConfig, InputIntent } from './types';

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

export class InputHandler {
  private intent: InputIntent = FRESH_INTENT();
  private keys = new Set<string>();
  private altMouseDown = false;
  private canvas: HTMLCanvasElement;
  private config: CameraConfig;

  constructor(canvas: HTMLCanvasElement, config: CameraConfig) {
    this.canvas = canvas;
    this.config = config;
    this.attach();
  }

  private attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (e.code === 'KeyR') this.intent.resetPressed = true;
    if (e.code === 'KeyT') this.intent.toggleTiltPressed = true;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.intent.zoomDelta += e.deltaY;
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.altKey) {
      this.altMouseDown = true;
      this.intent.isDragging = true;
    }
  };

  private onMouseUp = (): void => {
    this.altMouseDown = false;
    this.intent.isDragging = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    // Alt+drag rotation
    if (this.altMouseDown) {
      this.intent.dragDeltaX += e.movementX;
    }

    // Edge scrolling
    const rect = this.canvas.getBoundingClientRect();
    const m = this.config.edgeScrollMargin;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const speed = this.config.edgeScrollSpeed;

    if (x < m) this.intent.panX -= speed;
    else if (x > rect.width - m) this.intent.panX += speed;

    if (y < m) this.intent.panZ -= speed;
    else if (y > rect.height - m) this.intent.panZ += speed;
  };

  /** Returns accumulated intent and resets one-shot fields. Called once per frame. */
  consumeIntent(): InputIntent {
    // Accumulate held-key input
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.intent.panZ -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.intent.panZ += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.intent.panX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.intent.panX += 1;
    if (this.keys.has('KeyQ')) this.intent.yawDelta -= 1;
    if (this.keys.has('KeyE')) this.intent.yawDelta += 1;

    const out = { ...this.intent };
    this.intent = FRESH_INTENT();
    return out;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
  }
}
