// One owner per gesture. A second finger may press actions without stealing movement.
export function stickVector(x, z, deadZone = .12) {
  const length = Math.hypot(x, z);
  if (length <= deadZone) return { x: 0, z: 0 };
  const speed = Math.min(1, (length - deadZone) / (1 - deadZone));
  return { x: x / length * speed, z: z / length * speed };
}

export function installStick({ element, thumb, active, change }) {
  let pointer = null, bounds;
  const clear = () => {
    const old = pointer; pointer = null;
    if (old !== null && element.hasPointerCapture?.(old)) element.releasePointerCapture(old);
    thumb.style.transform = ''; change({ x: 0, z: 0 });
  };
  const move = event => {
    if (event.pointerId !== pointer) return;
    if (!active()) { clear(); return; }
    const radius = bounds.width * .34;
    const value = stickVector((event.clientX - bounds.left - bounds.width / 2) / radius,
      (event.clientY - bounds.top - bounds.height / 2) / radius);
    thumb.style.transform = `translate(${value.x * radius}px,${value.z * radius}px)`;
    change(value);
  };
  element.addEventListener('pointerdown', event => {
    if (pointer !== null || !active() || event.button !== 0) return;
    event.preventDefault(); pointer = event.pointerId; bounds = element.getBoundingClientRect();
    element.setPointerCapture(pointer); move(event);
  });
  element.addEventListener('pointermove', move);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    element.addEventListener(type, event => { if (event.pointerId === pointer) clear(); });
  }
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  window.addEventListener('resize', clear);
  return { clear };
}

// Drag on the playing surface to refine aim. Never fires a shot on release.
export function installTouchAim({ canvas, active, aim }) {
  let pointer = null;
  const clear = () => { pointer = null; };
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || pointer !== null || !active()) return;
    event.preventDefault(); pointer = event.pointerId; canvas.setPointerCapture(pointer); aim(event);
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId === pointer && active()) aim(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => { if (event.pointerId === pointer) clear(); });
  }
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
}

export function observeSurface(canvas, resize) {
  if (typeof ResizeObserver === 'undefined') return;
  // The canvas CSS size can change without a window resize (start, panels, rotation).
  const observer = new ResizeObserver(() => resize());
  observer.observe(canvas);
}
