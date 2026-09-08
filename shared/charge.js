// A charge is bound to one playable turn. Time is milliseconds, independent of FPS.
export class Charge {
  constructor(duration = 1100) { this.duration = duration; this.state = null; }
  begin(now, context) { if (this.state) return false; this.state = { now, context }; return true; }
  power(now) { return this.state ? Math.min(1, Math.max(.05, (now - this.state.now) / this.duration)) : 0; }
  release(now, context) {
    if (!this.state) return null;
    const value = this.state.context === context ? this.power(now) : null;
    this.state = null; return value;
  }
  cancel() { this.state = null; }
}

// Pointer capture also handles releasing outside the canvas. Touch still taps to aim.
export function installCharge({ canvas, enabled, context, aim, fire, secondary = () => {}, progress = () => {}, cancelled = () => {}, cancelKey = () => true }) {
  const charge = new Charge(); let pointer = null;
  const cancel = () => {
    const was = !!charge.state; charge.cancel();
    const id = pointer; pointer = null;
    if (id !== null && canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
    if (was) cancelled(); progress(null);
  };
  const update = (now = performance.now()) => {
    if (charge.state && (!enabled() || charge.state.context !== context())) cancel();
    if (charge.state) progress(charge.power(now));
  };
  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || !enabled()) return;
    if (e.button === 2) { e.preventDefault(); if (charge.state) cancel(); else secondary(); return; }
    if (e.button !== 0 || charge.state) return;
    e.preventDefault(); canvas.focus({ preventScroll: true }); aim?.(e);
    charge.begin(performance.now(), context()); pointer = e.pointerId;
    canvas.setPointerCapture?.(pointer); update();
  });
  canvas.addEventListener('pointerup', e => {
    if (e.pointerId !== pointer || e.button !== 0) return;
    const power = charge.release(performance.now(), enabled() ? context() : Symbol());
    const id = pointer; pointer = null;
    if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
    progress(null); if (power !== null) fire(power); else cancelled();
  });
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', cancel);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  // Opening a menu or using a different input method cancels unfinished gestures.
  document.addEventListener('pointerdown', e => { if (e.target !== canvas) cancel(); }, true);
  window.addEventListener('keydown', e => { if (!e.repeat && !['ShiftLeft', 'ShiftRight'].includes(e.code) && cancelKey(e)) cancel(); }, true);
  return { cancel, update, get charging() { return !!charge.state; } };
}
