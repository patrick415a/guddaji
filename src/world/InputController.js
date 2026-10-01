const MOVEMENT_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowLeft",
  "ArrowDown",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
]);
const INTERACTION_KEY = "KeyE";

export class InputController {
  constructor() {
    this.pressedKeys = new Set();
    this.touchAxes = { x: 0, y: 0 };
    this.touchRunning = false;
    this.enabled = true;
    this.interactQueued = false;
    this.jumpQueued = false;
    this.spaceHandled = false;
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.clear = this.clear.bind(this);
  }

  connect() {
    window.addEventListener("keydown", this.handleKeyDown, true);
    window.addEventListener("keyup", this.handleKeyUp, true);
    window.addEventListener("blur", this.clear);
    document.addEventListener("visibilitychange", this.clear);
  }

  disconnect() {
    window.removeEventListener("keydown", this.handleKeyDown, true);
    window.removeEventListener("keyup", this.handleKeyUp, true);
    window.removeEventListener("blur", this.clear);
    document.removeEventListener("visibilitychange", this.clear);
    this.clear();
  }

  handleKeyDown(event) {
    if (!this.enabled) return;
    if (event.code === 'Space') {
      if (event.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      // 게임 중에는 버튼에 포커스가 남아 있어도 클릭 대신 점프합니다.
      event.preventDefault();
      event.stopPropagation();
      this.spaceHandled = true;
      if (!event.repeat) this.jumpQueued = true;
      return;
    }
    if (event.code === INTERACTION_KEY) {
      if (!event.repeat) this.interactQueued = true;
      return;
    }
    if (!MOVEMENT_KEYS.has(event.code)) return;
    event.preventDefault();
    this.pressedKeys.add(event.code);
  }

  handleKeyUp(event) {
    if (event.code === 'Space' && this.spaceHandled) {
      event.preventDefault();
      event.stopPropagation();
      this.spaceHandled = false;
      return;
    }
    if (event.code === INTERACTION_KEY) return;
    if (!MOVEMENT_KEYS.has(event.code)) return;
    event.preventDefault();
    this.pressedKeys.delete(event.code);
  }

  clear() {
    this.spaceHandled = false;
    this.jumpQueued = false;
    this.pressedKeys.clear();
    this.setTouchAxes(0, 0);
    this.setTouchRunning(false);
    this.interactQueued = false;
  }

  consumeInteraction() {
    const wasQueued = this.interactQueued;
    this.interactQueued = false;
    return wasQueued;
  }

  consumeJump() {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  queueJump() {
    if (this.enabled) this.jumpQueued = true;
  }

  setTouchAxes(x, y) {
    if (!this.enabled && (x || y)) return;
    this.touchAxes.x = x;
    this.touchAxes.y = y;
  }

  queueInteraction() {
    if (!this.enabled) return;
    this.interactQueued = true;
  }

  setTouchRunning(active) { this.touchRunning = this.enabled && active; }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  getMovementAxes() {
    const left = this.isPressed("KeyA", "ArrowLeft");
    const right = this.isPressed("KeyD", "ArrowRight");
    const forward = this.isPressed("KeyW", "ArrowUp");
    const backward = this.isPressed("KeyS", "ArrowDown");

    return {
      x: Math.max(-1, Math.min(1, Number(right) - Number(left) + this.touchAxes.x)),
      y: Math.max(-1, Math.min(1, Number(forward) - Number(backward) + this.touchAxes.y)),
    };
  }

  isPressed(...codes) {
    return codes.some((code) => this.pressedKeys.has(code));
  }

  isRunning() { return this.touchRunning || this.isPressed("ShiftLeft", "ShiftRight"); }
}
