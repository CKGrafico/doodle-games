// The sports share action meanings, while each simulation owns its rules.
export const TEAM_KEYS = Object.freeze({
  Space: 'pass', KeyE: 'loft', KeyQ: 'shoot', Tab: 'switch', KeyF: 'defend',
  KeyJ: 'shoot', KeyK: 'through', KeyL: 'loft',
});

export function movement(x, z, camera) {
  // Use the actual camera orientation, including transitions between views.
  const m = camera.matrixWorld.elements;
  const yaw = Math.atan2(m[8], m[10]);
  const length = Math.max(1, Math.hypot(x, z));
  return {
    moveX: (x * Math.cos(yaw) + z * Math.sin(yaw)) / length,
    moveZ: (-x * Math.sin(yaw) + z * Math.cos(yaw)) / length,
  };
}

export function isEditing(target) {
  return target?.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(target?.tagName);
}

// Drain only inside a simulation step, never once per rendered frame.
export class ActionQueue {
  constructor() { this.actions = []; }
  push(action) { if (action && this.actions.length < 4) this.actions.push(action); }
  take() { return this.actions.shift() ?? null; }
  clear() { this.actions.length = 0; }
}

export function installLifecycle({ canvas, dialogs, clear, active, pause, fatal }) {
  const background = () => { clear(); if (active()) pause(); };
  window.addEventListener('blur', background);
  document.addEventListener('visibilitychange', () => { if (document.hidden) background(); });
  dialogs.forEach(dialog => {
    dialog.addEventListener('close', () => { clear(); canvas.focus({ preventScroll: true }); });
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); clear(); fatal(new Error('WebGL context lost'));
  });
}
