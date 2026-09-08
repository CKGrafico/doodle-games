import { PickleballGame, STEP } from './simulation.js';
import { movement, isEditing, installLifecycle, ActionQueue, wantsSprint } from '../shared/controls.js';
const $ = id => document.getElementById(id), keys = new Set(), actions = new ActionQueue();
const dialogs = [$('help-dialog'), $('pause-dialog'), $('result-dialog')];
let game = new PickleballGame(), view, playing = false, previous = 0, accumulator = 0, frameId;
let pointerShot = null, touchShot = null, bufferedShot = null, bufferUntil = 0, moveTouch = { x: 0, z: 0 }, joystickId = null;
let sound = false, audio, lastHUD = '', ready = false;
const paused = () => dialogs.some(d => d.open);
const active = () => playing && !paused() && game.stage !== 'over';
function clear() {
  keys.clear(); actions.clear(); pointerShot = touchShot = bufferedShot = null; bufferUntil = 0;
  moveTouch = { x: 0, z: 0 }; joystickId = null; accumulator = 0; $('joystick-thumb').style.transform = '';
}
function tone(type) {
  if (!sound) return;
  try {
    audio ??= new AudioContext(); audio.resume(); const o = audio.createOscillator(), g = audio.createGain(), now = audio.currentTime;
    o.type = 'triangle'; o.frequency.setValueAtTime(type === 'point' ? 720 : type === 'bounce' ? 180 : 390, now);
    o.frequency.exponentialRampToValueAtTime(type === 'point' ? 980 : 120, now + .1);
    g.gain.setValueAtTime(.045, now); g.gain.exponentialRampToValueAtTime(.0001, now + .16);
    o.connect(g); g.connect(audio.destination); o.start(now); o.stop(now + .18);
  } catch { sound = false; $('sound').textContent = 'Sound unavailable'; $('sound').setAttribute('aria-pressed', 'false'); }
}
function syncAssist() {
  $('assist-toggle').textContent = `Movement help: ${game.assisted ? 'on' : 'off'}`;
  $('assist-toggle').setAttribute('aria-pressed', String(game.assisted));
}
function syncUI() {
  document.body.classList.toggle('playing', playing);
  for (const id of ['lobby', 'court-note', 'lobby-footer']) $(id).hidden = playing;
  for (const id of ['hud', 'controls', 'pause', 'player-label', 'rule-status']) $(id).hidden = !playing;
  $('touch-controls').hidden = !playing || !(matchMedia('(pointer:coarse)').matches || innerWidth < 650);
  $('callout').hidden = !playing; view.setLobby(!playing); syncAssist(); lastHUD = '';
}
function start() {
  if (!ready) return; dialogs.forEach(d => d.close()); clear();
  game = new PickleballGame({ target: $('target').value, difficulty: $('difficulty').value, assisted: $('assist').checked, seed: Date.now() });
  playing = true; syncUI(); $('court').focus();
}
function quit() {
  dialogs.forEach(d => d.close()); clear(); playing = false; game = new PickleballGame(); syncUI(); $('start').focus();
}
function pause() { if (active()) { clear(); $('pause-dialog').showModal(); } }
function hud() {
  const snapshot = [game.stage, ...game.score.points, game.score.server, game.score.serverNumber, game.rallyHits, game.message, ...(game.rally?.mustBounce ?? [])].join('|');
  if (snapshot === lastHUD) return; lastHUD = snapshot;
  $('your-points').textContent = game.score.points[0]; $('their-points').textContent = game.score.points[1];
  $('score-call').textContent = game.score.call; $('score-call').setAttribute('aria-label', `Serving score ${game.score.points[game.score.team]}, receiving score ${game.score.points[1 - game.score.team]}, server ${game.score.serverNumber}`);
  $('match-mode').textContent = `FIRST TO ${game.score.target} · WIN BY 2`;
  $('serve-label').textContent = `${game.score.team === 0 ? 'YOUR' : 'DISTRICT'} SERVE · ${game.score.serverNumber}`;
  $('rally-count').textContent = game.rallyHits;
  $('callout').hidden = !playing || !['ready', 'between'].includes(game.stage);
  $('callout-title').textContent = game.message;
  $('callout-detail').textContent = game.stage === 'ready' ? game.score.team === 0 ? 'Press Space or tap Hit. Aim for the highlighted box.' : 'Get ready. The serve must bounce.' : `Next call: ${game.score.call}`;
  const rule = game.rally?.mustBounce;
  $('rule-status').textContent = game.stage === 'ready' ? `Score only on serve · ${game.score.serverNumber === 1 ? 'First' : 'Second'} server` : game.stage === 'between' ? 'Reset your feet. Next rally coming up.' : rule?.some(Boolean) ? (game.rally.serve ? 'Let the serve bounce' : 'Let the return bounce') : 'Volleys allowed outside the kitchen · F for a dink';
}
function input() {
  const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + moveTouch.x;
  const z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')) + moveTouch.z;
  const shot = touchShot || pointerShot || (keys.has('KeyF') ? 'dink' : keys.has('KeyE') ? 'lob' : keys.has('KeyQ') ? 'smash' : keys.has('Space') ? 'drive' : performance.now() < bufferUntil ? bufferedShot : null);
  return { ...movement(x, z, view.camera), sprint: wantsSprint(keys, moveTouch), shot, switch: actions.take() === 'switch', aim: game.aim };
}
function frame(now) {
  frameId = requestAnimationFrame(frame); const dt = Math.min((now - previous) / 1000 || 0, .06); previous = now;
  if (active()) {
    accumulator = Math.min(accumulator + dt, STEP * 8);
    while (accumulator >= STEP) { game.step(STEP, input()); accumulator -= STEP; }
    for (const event of game.drainEvents()) {
      if (['hit', 'bounce', 'net', 'point'].includes(event.type)) tone(event.type);
      if (event.type === 'point' && event.match) {
        $('result-title').textContent = event.winner === 0 ? 'The kitchen is yours.' : 'Another page, another chance.';
        $('result-score').textContent = game.score.points.join(' : ');
        $('result-stats').textContent = `${game.totalRallies} rallies · Longest: ${game.bestRally} shots · Your team: ${game.stats.dinks[0]} dinks, ${game.stats.volleys[0]} volleys`;
        clear(); $('result-dialog').showModal();
      }
    }
    hud();
  } else accumulator = 0;
  const label = view.render(game, dt, now / 1000); $('player-label').style.left = label.x + 'px'; $('player-label').style.top = label.y + 'px';
}
function fatal(error) {
  cancelAnimationFrame(frameId); ready = false; playing = false; clear(); $('start').disabled = true; $('error').hidden = false;
  $('error-text').textContent = 'The court could not load. Enable graphics acceleration and reload to try again.'; console.error(error);
}
function buffer(shot) { bufferedShot = shot; bufferUntil = performance.now() + 140; }
$('start').onclick = start; $('restart').onclick = start; $('rematch').onclick = start;
$('quit').onclick = quit; $('result-quit').onclick = quit; $('pause').onclick = pause;
$('resume').onclick = () => $('pause-dialog').close(); $('help').onclick = () => { clear(); $('help-dialog').showModal(); };
$('reload').onclick = () => location.reload();
for (const button of document.querySelectorAll('[data-close]')) button.onclick = () => $(button.dataset.close).close();
$('sound').onclick = () => { sound = !sound; $('sound').textContent = sound ? 'Sound on' : 'Sound off'; $('sound').setAttribute('aria-pressed', String(sound)); tone('hit'); };
$('camera').onclick = () => { if (!view) return; view.mode = view.mode === 'raised' ? 'end' : 'raised'; $('camera').textContent = `Camera: ${view.mode}`; $('court').focus(); };
$('assist-toggle').onclick = () => { game.assisted = !game.assisted; syncAssist(); $('court').focus(); };
const shotKeys = { Space: 'drive', KeyE: 'lob', KeyQ: 'smash', KeyF: 'dink' };
window.addEventListener('keydown', event => {
  if (isEditing(event.target)) return;
  if (event.key === '?' && !paused()) { event.preventDefault(); $('help').click(); return; }
  if (event.code === 'Escape' || event.code === 'KeyP') { if (active()) { event.preventDefault(); pause(); } return; }
  if (!active()) return;
  if (shotKeys[event.code] || event.code === 'Tab' || event.code.startsWith('Arrow')) event.preventDefault();
  keys.add(event.code);
  if (!event.repeat && shotKeys[event.code]) buffer(shotKeys[event.code]);
  if (!event.repeat && event.code === 'Tab') actions.push('switch');
});
window.addEventListener('keyup', event => keys.delete(event.code));
$('court').addEventListener('pointermove', event => { if (view && active() && event.pointerType !== 'touch') { const aim = view.aimAt(event.clientX, event.clientY); if (aim) game.aim = aim; } });
$('court').addEventListener('pointerdown', event => {
  if (!view || !active()) return; event.preventDefault(); $('court').focus(); const aim = view.aimAt(event.clientX, event.clientY); if (aim) game.aim = aim;
  if (event.pointerType !== 'touch' && [0, 2].includes(event.button)) { pointerShot = event.button === 2 ? 'lob' : 'drive'; buffer(pointerShot); }
});
window.addEventListener('pointerup', () => { pointerShot = null; }); window.addEventListener('pointercancel', () => { pointerShot = null; });
$('court').addEventListener('contextmenu', event => event.preventDefault());
for (const button of document.querySelectorAll('[data-shot]')) {
  button.onpointerdown = event => { if (!active()) return; event.preventDefault(); button.setPointerCapture(event.pointerId); touchShot = button.dataset.shot; buffer(touchShot); };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => { if (touchShot === button.dataset.shot) touchShot = null; });
}
$('switch-player').onpointerdown = event => { if (active()) { event.preventDefault(); actions.push('switch'); } };
function moveStick(event) {
  if (event.pointerId !== joystickId) return;
  const rect = $('joystick').getBoundingClientRect(), radius = rect.width * .34;
  let x = (event.clientX - rect.left - rect.width / 2) / radius, z = (event.clientY - rect.top - rect.height / 2) / radius;
  const length = Math.max(1, Math.hypot(x, z)); x /= length; z /= length;
  moveTouch = { x, z }; $('joystick-thumb').style.transform = `translate(${x * radius}px,${z * radius}px)`;
}
$('joystick').onpointerdown = event => { if (!active()) return; event.preventDefault(); joystickId = event.pointerId; $('joystick').setPointerCapture(joystickId); moveStick(event); };
$('joystick').onpointermove = moveStick;
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('joystick').addEventListener(type, event => { if (event.pointerId === joystickId) { joystickId = null; moveTouch = { x: 0, z: 0 }; $('joystick-thumb').style.transform = ''; } });
window.addEventListener('resize', () => { if (view) { view.resize(); $('touch-controls').hidden = !playing || !(matchMedia('(pointer:coarse)').matches || innerWidth < 650); } });
installLifecycle({ canvas: $('court'), dialogs, clear, active, pause, fatal });
try {
  const { PickleballView } = await import('./render.js'); await document.fonts.ready;
  view = new PickleballView($('court')); ready = true; $('start').disabled = false; $('start').textContent = 'LET’S PLAY ↗'; requestAnimationFrame(frame);
} catch (error) { fatal(error); }
