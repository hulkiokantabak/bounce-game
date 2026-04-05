export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.onTap = null;

    canvas.addEventListener('touchstart', (e) => this.handleTouch(e), { passive: false });
    canvas.addEventListener('mousedown', (e) => this.handleMouse(e));
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  }

  handleTouch(e) {
    e.preventDefault();
    if (!this.onTap) return;
    // Use the most recent touch (last in changedTouches) for better palm rejection on tablets
    const touch = e.changedTouches[e.changedTouches.length - 1];
    const rect = this.canvas.getBoundingClientRect();
    this.onTap(touch.clientX - rect.left, touch.clientY - rect.top);
  }

  handleMouse(e) {
    if (!this.onTap) return;
    const rect = this.canvas.getBoundingClientRect();
    this.onTap(e.clientX - rect.left, e.clientY - rect.top);
  }
}
