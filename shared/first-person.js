import * as THREE from '../vendor/three.module.min.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const LOOK_SPORTS = ['padel', 'pickleball', 'football', 'waterpolo', 'sheep'];
export const PRECISION_SPORTS = ['golf', 'petanca', 'curling', 'pool'];

// Relative movement never reprojects the rotating camera onto its own aim plane.
export function adjustPrecision(game, kind, dx, fine = false) {
  const gain = (kind === 'curling' ? .00035 : kind === 'petanca' ? .001 : .0025) * (fine ? .2 : 1);
  const delta = clamp(dx, -160, 160) * gain;
  if (kind === 'golf') game.angle -= delta;
  else if (kind === 'pool') game.heading = game.angle - delta;
  else if (kind === 'curling') game.heading = game.angle + delta;
  else game.heading = clamp(game.heading + delta, -.42, .42);
}

export function installFirstPerson(view, kind, { active, canAim = active, charging = () => false }, refresh, clear) {
  const precision = PRECISION_SPORTS.includes(kind), look = LOOK_SPORTS.includes(kind);
  if (!precision && !look) return null;
  const canvas = view.canvas;
  let last = null, yaw = 0, pitch = 0, mouseEvent = false, locked = false;
  const enabled = () => view.views?.mode === 'first' && active();
  const lock = document.createElement('button'); lock.type = 'button'; lock.textContent = 'Lock mouse';
  const hint = document.createElement('span');
  hint.textContent = precision ? 'Mouse: aim · Shift: fine · hold click: power' : 'Mouse: look · WASD: move · hold click: power';
  const controls = document.createElement('div'); controls.className = 'first-person-controls'; controls.hidden = true;
  controls.append(hint, lock); document.querySelector('.controls, .view-controls, .control-actions')?.append(controls);
  const marker = document.createElement('div'); marker.className = 'first-person-reticle'; marker.hidden = true;
  marker.setAttribute('aria-hidden', 'true'); document.body.append(marker);
  const originalAim = view.aimAt?.bind(view);
  if (originalAim) view.aimAt = (x, y) => {
    if (!enabled() || !mouseEvent) return originalAim(x, y);
    if (precision && canAim()) return null; // Keep the heading when starting a charge.
    if (!look) return originalAim(x, y); // Pool ball-in-hand still uses the table.
    return target();
  };
  function target() {
    const direction = view.camera.getWorldDirection(new THREE.Vector3());
    const eye = view.camera.position;
    const distance = clamp(direction.y < -.015 ? -eye.y / direction.y : 40, 2, kind === 'football' ? 100 : 35);
    const point = eye.clone().addScaledVector(direction, distance);
    const bounds = kind === 'football' ? [34, 54] : kind === 'sheep' ? [14, 19] : kind === 'waterpolo' ? [10, 15] : kind === 'padel' ? [5, 10] : [3.05, 6.7];
    return { x: clamp(point.x, -bounds[0], bounds[0]), z: clamp(point.z, -bounds[1], bounds[1]) };
  }
  function release() {
    last = null;
    if (document.pointerLockElement === canvas) document.exitPointerLock?.();
  }
  lock.addEventListener('click', async () => {
    if (!enabled()) return;
    clear(); last = null; canvas.focus({ preventScroll: true });
    try { await canvas.requestPointerLock?.(); }
    catch { hint.textContent = 'Mouse lock unavailable. Move within the game to aim; leave and re-enter to reposition.'; }
  });
  lock.hidden = !canvas.requestPointerLock;
  document.addEventListener('pointerlockchange', () => {
    const next = document.pointerLockElement === canvas;
    if (locked && !next) clear();
    locked = next; last = null; lock.textContent = locked ? 'Esc: release mouse' : 'Lock mouse';
    if (locked && !enabled()) release();
  });
  document.addEventListener('pointerlockerror', () => { hint.textContent = 'Move within the game to aim. Leave and re-enter to reposition.'; });
  canvas.addEventListener('pointerdown', e => { mouseEvent = e.pointerType !== 'touch'; }, true);
  canvas.addEventListener('pointermove', e => {
    mouseEvent = e.pointerType !== 'touch';
    if (!mouseEvent || !enabled()) { last = null; return; }
    const dx = locked ? e.movementX : last ? e.clientX - last.x : 0;
    const dy = locked ? e.movementY : last ? e.clientY - last.y : 0;
    last = { x: e.clientX, y: e.clientY };
    if (precision && canAim()) {
      e.stopImmediatePropagation();
      if (!charging()) { adjustPrecision(view.views.game, kind, dx, e.shiftKey); refresh(); }
    } else if (look) {
      yaw -= clamp(dx || 0, -160, 160) * .0025;
      pitch = clamp(pitch - clamp(dy || 0, -160, 160) * .0025, -.9, .65);
      refresh();
    }
  }, true);
  canvas.addEventListener('pointerleave', () => { last = null; });
  canvas.addEventListener('wheel', e => {
    if (!enabled() || !canAim() || charging() || !['golf', 'petanca'].includes(kind)) return;
    e.preventDefault();
    const game = view.views.game, delta = Math.sign(e.deltaY) * (e.shiftKey ? .005 : .02);
    if (kind === 'golf') game.power = clamp(game.power - delta, .05, 1);
    else game.reach = clamp(game.reach - delta * 10, game.stage === 'jack' ? 6 : 2, game.stage === 'jack' ? 10 : 13);
  }, { passive: false });
  window.addEventListener('blur', () => { release(); clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { release(); clear(); } });
  window.addEventListener('keydown', e => {
    if (['Escape', 'KeyP'].includes(e.code) || e.key === '?') { release(); last = null; }
    // Ignore the next absolute delta after keyboard adjustments or UI focus.
    if (!locked) last = null;
  }, true);
  return {
    orient(camera) {
      if (look) { const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); euler.y += yaw; euler.x = clamp(euler.x + pitch, -1.2, 1.05); camera.quaternion.setFromEuler(euler); }
    },
    update(game) {
      const show = enabled(); controls.hidden = !show; marker.hidden = !show || (!look && !canAim());
      if (!show) { release(); return; }
      const rect = canvas.getBoundingClientRect(); marker.style.left = rect.left + rect.width / 2 + 'px'; marker.style.top = rect.top + rect.height / 2 + 'px';
      if (look && mouseEvent) game.aim = target();
    },
    reset() { yaw = 0; pitch = 0; release(); },
  };
}
