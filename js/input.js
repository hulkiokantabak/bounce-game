export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.onTap = null;
    this.onHoldRemove = null; // fires after 180ms hold on existing surface

    this._holdTimer = null;
    this._holdX = 0;
    this._holdY = 0;
    const HOLD_MS = 180;

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!this.onTap) return;
      const touch = e.changedTouches[e.changedTouches.length - 1];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      this._holdX = x;
      this._holdY = y;

      // After HOLD_MS with finger still down, trigger hold-remove
      this._holdTimer = setTimeout(() => {
        this._holdTimer = null;
        if (this.onHoldRemove) this.onHoldRemove(this._holdX, this._holdY);
      }, HOLD_MS);
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (this._holdTimer !== null) {
        // Released before hold threshold — fire tap (normal placement)
        clearTimeout(this._holdTimer);
        this._holdTimer = null;
        if (this.onTap) this.onTap(this._holdX, this._holdY);
      }
      // If timer already fired (hold), do nothing — action already taken
    }, { passive: false });

    canvas.addEventListener('touchcancel', (e) => {
      if (this._holdTimer !== null) {
        clearTimeout(this._holdTimer);
        this._holdTimer = null;
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.onTap) return;
      const rect = this.canvas.getBoundingClientRect();
      // Mouse: pass isMouse=true so handleTap can allow instant surface removal
      this.onTap(e.clientX - rect.left, e.clientY - rect.top, true);
    });
  }
}
