import * as THREE from '../vendor/three.module.min.js';

export const CAMERA_MODES = ['third', 'top', 'first'];
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Poses are expressed in each sport's world, not in screen coordinates.
export function cameraFrame(kind, game, view = {}) {
  const p = game.players?.[game.controlled] ?? { x: 0, z: 0, team: 0 };
  const frame = { focus: [0, 0, 0], width: 14, depth: 25, eye: [p.x, 1.65, p.z], look: [p.x, .8, p.z - 12] };
  if (kind === 'padel' || kind === 'pickleball') {
    const direction = p.team === 0 ? -1 : 1;
    frame.width = kind === 'padel' ? 13 : 11; frame.depth = kind === 'padel' ? 24 : 20;
    frame.look = [p.x, .7, p.z + direction * 12];
  } else if (kind === 'football' || kind === 'waterpolo') {
    const direction = game.d?.(p.team) ?? -1;
    frame.width = kind === 'football' ? 76 : 23; frame.depth = kind === 'football' ? 118 : 34;
    frame.eye = [p.x, kind === 'football' ? 2.3 : 1.1, p.z];
    frame.look = [p.x, .45, p.z + direction * 18];
  } else if (kind === 'golf') {
    const b = game.ball, tee = game.hole.tee, cup = game.hole.cup;
    frame.focus = [(tee.x + cup.x) / 2, 0, (tee.z + cup.z) / 2];
    frame.width = 100; frame.depth = Math.abs(tee.z - cup.z) + 80;
    const stand = game.stage === 'flight' ? game.lastSafe : b;
    const dx = Math.sin(game.angle), dz = Math.cos(game.angle);
    frame.eye = [stand.x - dx * 1.8, 2.2, stand.z - dz * 1.8];
    frame.look = game.stage === 'flight' ? [b.x, b.y, b.z] : [b.x + dx * 12, .2, b.z + dz * 12];
  } else if (kind === 'petanca') {
    frame.width = 6; frame.depth = 17;
    frame.eye = [0, 1.6, 6.8]; frame.look = [Math.sin(game.heading) * 7, .15, 6.3 - Math.cos(game.heading) * 7];
  } else if (kind === 'curling') {
    frame.width = 6.4; frame.depth = 21;
    frame.eye = [0, 1.5, 9.7]; frame.look = [Math.sin(game.angle) * 9, .1, -.5];
  } else if (kind === 'pool') {
    const b = game.balls[0], dx = Math.sin(game.angle), dz = Math.cos(game.angle);
    frame.width = 6.4; frame.depth = 11.8;
    frame.eye = [b.x - dx * 1.3, 1, b.z - dz * 1.3]; frame.look = [b.x + dx * 3, .1, b.z + dz * 3];
  } else if (kind === 'climbing') {
    const climber = game.player;
    frame.focus = [0, 8, .3]; frame.width = 13; frame.depth = 19;
    // A wall is vertical: the overhead inspection looks down its face from the top.
    frame.topEye = [0, 23, 15]; frame.topUp = [0, 1, 0];
    frame.eye = [-2.55 + climber.x, climber.y + .58, 1.05];
    frame.look = [-2.55 + climber.x, climber.y + 1.5, .1];
  } else if (kind === 'ski' || kind === 'surf') {
    const base = view.heightAt?.(game.x, 0, game.z) ?? 0;
    const jump = game.air ? Math.sin(Math.PI * (1 - game.air / game.airDuration)) * (1.5 + game.airDuration) : 0;
    frame.focus = [0, kind === 'ski' ? -2 : 1, -13]; frame.width = 20; frame.depth = 47;
    frame.eye = [game.x, base + jump + 1.65, .12];
    frame.look = [game.x, kind === 'ski' ? -1.7 : base + .5, -18];
  }
  return frame;
}

function playerObject(view, kind, game) {
  if (kind === 'golf') return view.golfer;
  if (kind === 'climbing') return view.people?.[0];
  if (kind === 'surf' || kind === 'ski') return view.rider;
  const model = (view.players ?? view.people)?.[game.controlled];
  return model?.root ?? model;
}

export function installViews(view, kind, clearInput = () => {}) {
  const baseCamera = view.camera;
  const top = new THREE.OrthographicCamera(-10, 10, 10, -10, .05, 1600);
  const first = new THREE.PerspectiveCamera(82, 1, .045, 1600);
  let mode = 'third', currentGame, frame = null;
  try { const saved = localStorage.getItem('doodle-camera:' + kind); if (CAMERA_MODES.includes(saved)) mode = saved; } catch { /* Storage is optional. */ }
  const renderScene = view.renderer.render.bind(view.renderer), renderGame = view.render.bind(view), resize = view.resize.bind(view);
  function apply(cameraMode) {
    if (!currentGame || cameraMode === 'third') { view.camera = baseCamera; return baseCamera; }
    frame = cameraFrame(kind, currentGame, view);
    const rect = view.canvas.getBoundingClientRect(), aspect = Math.max(.1, rect.width / Math.max(1, rect.height));
    if (cameraMode === 'top') {
      const height = Math.max(frame.depth, frame.width / aspect);
      top.left = -height * aspect / 2; top.right = -top.left; top.top = height / 2; top.bottom = -height / 2;
      top.up.set(...(frame.topUp ?? [0, 0, -1]));
      top.position.set(...(frame.topEye ?? [frame.focus[0], frame.focus[1] + 400, frame.focus[2] + .001]));
      top.lookAt(...frame.focus); top.updateProjectionMatrix(); top.updateMatrixWorld(); view.camera = top; return top;
    }
    first.aspect = aspect; first.up.set(0, 1, 0); first.position.set(...frame.eye); first.lookAt(...frame.look);
    first.updateProjectionMatrix(); first.updateMatrixWorld(); view.camera = first; return first;
  }
  // The original renderers keep their own framing. The final camera is shared by
  // rasterization, ray aiming, world-relative movement and projected player labels.
  view.renderer.render = (scene, camera) => {
    const chosen = currentGame ? apply(mode) : camera;
    const ownLabel = document.getElementById('player-label');
    if (ownLabel) ownLabel.style.visibility = mode === 'first' ? 'hidden' : '';
    const model = mode === 'first' && currentGame ? playerObject(view, kind, currentGame) : null;
    const wasVisible = model?.visible;
    if (model) model.visible = false;
    try { renderScene(scene, chosen); } finally { if (model) model.visible = wasVisible; }
  };
  view.render = (...args) => {
    currentGame = args[0]; view.camera = baseCamera;
    try { return renderGame(...args); } finally { apply(mode); }
  };
  view.resize = (...args) => {
    view.camera = baseCamera;
    try { return resize(...args); } finally { apply(mode); }
  };
  const label = document.createElement('label'); label.className = 'camera-views'; label.textContent = 'View ';
  const select = document.createElement('select'); select.setAttribute('aria-label', 'Camera view');
  for (const [value, text] of [['third', '3rd person'], ['top', 'Top view'], ['first', '1st person']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
  }
  select.value = mode; label.append(select);
  const oldButton = document.getElementById('camera');
  const parent = oldButton?.parentElement ?? document.querySelector('.control-actions') ?? document.querySelector('.surface, .ride-arena');
  if (oldButton) oldButton.hidden = true;
  if (parent?.matches('.surface, .ride-arena')) label.classList.add('floating');
  parent?.append(label);
  function setMode(value) {
    if (!CAMERA_MODES.includes(value)) return;
    clearInput(); mode = value; select.value = value; apply(mode);
    try { localStorage.setItem('doodle-camera:' + kind, mode); } catch { /* Storage is optional. */ }
    view.canvas.focus({ preventScroll: true });
  }
  select.addEventListener('change', () => setMode(select.value));
  view.views = { setMode, get mode() { return mode; } };
  return view.views;
}
