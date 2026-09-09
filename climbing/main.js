import { isEditing, installLifecycle } from '../shared/controls.js';
import { installCharge, Charge } from '../shared/charge.js';
import { ClimbingGame, HOLDS, STEP } from './simulation.js';

const $ = id => document.getElementById(id);
const dialogs = [$('help-dialog'), $('pause-dialog')];
let game = new ClimbingGame(), view, playing = false, frameId, previous = 0, accumulator = 0, mouse;
let buttonPointer = null, keyboardCharge = new Charge(), keyboardHeld = false, shownPower = 0;
const paused = () => dialogs.some(dialog => dialog.open);
const active = () => playing && !paused() && ['countdown', 'racing'].includes(game.stage);
const canMove = () => active() && !game.player.moving;

function clear() {
  mouse?.cancel(); keyboardCharge.cancel(); keyboardHeld = false; buttonPointer = null; shownPower = 0; accumulator = 0;
}
function fatal(error) {
  clear(); playing = false; cancelAnimationFrame(frameId); $('start').disabled = true; $('error').hidden = false; console.error(error);
}
function start() {
  clear(); dialogs.forEach(dialog => dialog.close()); game = new ClimbingGame({ difficulty: $('difficulty').value, seed: Date.now() });
  playing = true; document.body.classList.add('playing'); $('lobby').hidden = true; $('match').hidden = false; $('pause').hidden = false;
  game.start(); sync(); $('court').focus({ preventScroll: true });
}
function quit() {
  clear(); dialogs.forEach(dialog => dialog.close()); playing = false; game = new ClimbingGame(); document.body.classList.remove('playing');
  $('lobby').hidden = false; $('match').hidden = true; $('pause').hidden = true; view.setLobby(true); $('start').focus();
}
function aim(event) {
  if (!view || game.stage !== 'racing' || game.player.moving) return;
  const point = view.aimAt(event.clientX, event.clientY); if (point) game.aimAt(point.y);
}
function release(power) {
  shownPower = 0; if (game.stage === 'countdown') game.falseStartNow(); else game.move(power); sync();
}
function beginCharge(now = performance.now()) {
  if (!canMove()) return false;
  if (game.stage === 'countdown') { release(.05); return false; }
  return keyboardCharge.begin(now, game.context);
}
function sync() {
  const player = game.player, rival = game.climbers[1];
  $('blue-time').textContent = player.time?.toFixed(2) ?? game.raceTime.toFixed(2);
  $('red-time').textContent = rival.time?.toFixed(2) ?? game.raceTime.toFixed(2);
  $('countdown').textContent = game.stage === 'countdown' ? game.timer > 1.8 ? 'READY' : game.timer > .8 ? 'SET' : '●' : game.stage === 'racing' ? 'GO!' : game.winner === 0 ? 'BLUE WINS' : 'RED WINS';
  $('status').textContent = game.message; $('height').textContent = `${player.y.toFixed(1)} / 15 m`; $('combo').textContent = `Flow ×${player.combo}`;
  $('grip-value').textContent = `${Math.round(player.grip * 100)}%`; $('grip-fill').style.width = `${player.grip * 100}%`;
  $('target').min = Math.min(player.hold + 1, HOLDS.length - 1); $('target').value = game.target; $('target').disabled = game.stage !== 'racing' || !!player.moving;
  $('power-value').textContent = `${Math.round(shownPower * 100)}%`; $('power-fill').style.width = `${shownPower * 100}%`;
  $('move').disabled = !canMove(); $('again').hidden = game.stage !== 'finished'; view?.setLobby(!playing);
}
function loop(now) {
  frameId = requestAnimationFrame(loop); const dt = Math.min((now - previous) / 1000 || 0, .06); previous = now;
  mouse?.update(now);
  if (keyboardCharge.state) { shownPower = keyboardCharge.power(now); }
  if (active()) {
    accumulator = Math.min(accumulator + dt, STEP * 8);
    while (accumulator >= STEP) { game.step(STEP); accumulator -= STEP; }
    for (const event of game.drainEvents()) if (event.type === 'finish' || event.type === 'false-start') clear();
  } else accumulator = 0;
  sync(); view.render(game, dt, now / 1000);
}

$('start').onclick = () => view && start(); $('again').onclick = start; $('restart').onclick = start; $('quit').onclick = quit;
$('help').onclick = () => { clear(); $('help-dialog').showModal(); };
$('pause').onclick = () => { if (active()) { clear(); $('pause-dialog').showModal(); } };
$('resume').onclick = () => $('pause-dialog').close(); $('reload').onclick = () => location.reload();
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $(button.dataset.close).close());
$('target').oninput = event => game.select(Number(event.target.value));

window.addEventListener('keydown', event => {
  if (isEditing(event.target)) return;
  if (event.code === 'Escape' || event.code === 'KeyP') { $('pause').click(); return; }
  if (event.key === '?') { $('help').click(); return; }
  if (!active()) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  if (event.code === 'Space' && !event.repeat) { keyboardHeld = true; beginCharge(); }
  if (!event.repeat && game.stage === 'racing' && ['ArrowUp', 'ArrowRight'].includes(event.code)) game.select(Math.min(game.target + 1, HOLDS.length - 1));
  if (!event.repeat && game.stage === 'racing' && ['ArrowDown', 'ArrowLeft'].includes(event.code)) game.select(Math.max(game.target - 1, game.player.hold + 1));
});
window.addEventListener('keyup', event => {
  if (event.code !== 'Space' || !keyboardHeld) return; keyboardHeld = false;
  const power = keyboardCharge.release(performance.now(), game.context); if (power !== null) release(power);
});

$('move').addEventListener('pointerdown', event => {
  if (!canMove()) return; event.preventDefault(); buttonPointer = event.pointerId; $('move').setPointerCapture(event.pointerId); beginCharge();
});
function endButton(event) {
  if (event.pointerId !== buttonPointer) return; buttonPointer = null;
  const power = keyboardCharge.release(performance.now(), game.context); if (power !== null) release(power);
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('move').addEventListener(type, endButton);
$('court').addEventListener('pointermove', event => { if (event.pointerType !== 'touch' && !mouse?.charging) aim(event); });
$('court').addEventListener('pointerdown', event => { if (event.pointerType === 'touch') { event.preventDefault(); aim(event); $('court').focus(); } });
$('court').addEventListener('pointerdown', () => { if (game.stage === 'countdown') game.falseStartNow(); });

mouse = installCharge({ canvas: $('court'), enabled: canMove, context: () => game.context, aim,
  progress: power => { shownPower = power ?? 0; }, cancelled: () => { shownPower = 0; }, fire: release });
installLifecycle({ canvas: $('court'), dialogs, clear, active, pause: () => $('pause').click(), fatal });
window.addEventListener('resize', () => view?.resize());
try {
  const { ClimbingView } = await import('./render.js'); await document.fonts.ready; view = new ClimbingView($('court'));
  $('start').disabled = false; sync(); frameId = requestAnimationFrame(loop);
} catch (error) { fatal(error); }
