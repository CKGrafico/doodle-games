import { installViews } from './cameras.js';
import { isEditing } from './controls.js';
import { installStick, observeSurface } from './touch.js';
import { Charge, installCharge } from './charge.js';
import { clamp } from './ride-physics.js';
const $ = id => document.getElementById(id);

export async function bootRide({ Game, View, installLifecycle }) {
  let game = new Game(), view, frame, last = 0, accumulator = 0, nextHud = 0;
  let stickValue = 0, pointerLane = 0, pointerTurn = 0, mode = 'keyboard';
  let braking = false, brakePointer = null, mouse, button, power = 0, flashUntil = 0;
  let audio, sound = false, best = null;
  const keyboard = new Charge(), keys = new Set();
  const dialogs = [$('help-dialog'), $('pause-dialog')];
  const active = () => game.stage === 'riding' && !dialogs.some(d => d.open);
  const canAct = () => active() && game.canAct;
  const storageKey = () => 'doodle-rides-v2:' + game.kind + ':' + game.course;
  function loadBest() {
    try { best = Number(localStorage.getItem(storageKey())) || null; } catch { best = null; }
  }
  const stick = installStick({
    element: $('joystick'), thumb: $('joystick-thumb'), active,
    change: value => { stickValue = value.x; if (value.x) mode = 'touch'; },
  });
  const clear = () => {
    keys.clear(); keyboard.cancel(); mouse?.cancel(); button?.cancel(); stick.clear();
    mode = 'keyboard'; pointerTurn = 0; braking = false; power = 0; accumulator = 0;
    const id = brakePointer; brakePointer = null;
    if (id !== null && $('brake').hasPointerCapture(id)) $('brake').releasePointerCapture(id);
  };
  function fatal(error) {
    clear(); cancelAnimationFrame(frame); $('error').hidden = false; $('start').disabled = true; console.error(error);
  }
  function tone(type) {
    if (!sound) return;
    try {
      audio ??= new AudioContext(); audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
      osc.type = 'triangle'; osc.frequency.setValueAtTime(type === 'crash' ? 150 : type === 'bank' ? 740 : 440, now);
      osc.frequency.exponentialRampToValueAtTime(type === 'crash' ? 55 : 880, now + .12);
      gain.gain.setValueAtTime(.035, now); gain.gain.exponentialRampToValueAtTime(.001, now + .17);
      osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + .18);
    } catch { sound = false; }
  }
  function feedback(now) {
    for (const event of game.drainEvents()) {
      $('feedback-title').textContent = event.label;
      $('feedback-value').textContent = event.value ? '+' + event.value : '';
      $('feedback').dataset.type = event.type; $('feedback').hidden = false;
      flashUntil = now + (event.type === 'hint' ? 2600 : 1600);
      if (['trick', 'bank', 'crash', 'finish', 'gate'].includes(event.type)) tone(event.type);
      view?.burst(event.type);
    }
  }
  function featureText() {
    const feature = game.nextFeature;
    if (!feature) return 'Finish ahead · bring it home';
    const distance = Math.max(0, Math.round(feature.z - game.z));
    const name = feature.type === 'tube' ? 'BARREL' : feature.type === 'air' ? 'AIR SECTION' : feature.type === 'ramp' ? 'RAMP' : 'BOOST LINE';
    return name + ' · ' + (distance ? distance + ' m' : 'NOW') + ' · ' + (feature.x > 0 ? 'RIGHT' : 'LEFT');
  }
  function sync() {
    const surf = game.kind === 'surf', playing = game.stage !== 'ready';
    $('lobby').hidden = playing; $('hud').hidden = !playing; $('touch-controls').hidden = game.stage !== 'riding';
    $('pause').hidden = game.stage !== 'riding'; $('result').hidden = game.stage !== 'finished';
    $('wave-break').hidden = game.stage !== 'between';
    document.body.classList.toggle('playing', playing);
    document.body.classList.toggle('airborne', !!game.air);
    $('speed').textContent = Math.round(game.speed * 3.6) + ' km/h';
    $('score').textContent = surf ? game.total + ' pts' : '#' + game.rank + ' / 4';
    $('detail').textContent = surf ? game.config.name + ' · WAVE ' + game.wave + '/3'
      : game.config.name + ' · ' + game.time.toFixed(1) + ' s';
    $('progress').value = game.z / game.length;
    $('feature').textContent = featureText();
    $('energy').value = game.energy; $('power').value = power;
    $('combo-title').textContent = surf ? (game.combo ? 'FLOW ×' + game.combo + ' · ' + game.comboValue + ' at risk' : 'Build a combo')
      : (game.streak ? 'CLEAN LINE ×' + game.streak : 'Clean gates = more boost');
    $('combo-time').value = surf ? game.comboTime / 5 : game.energy;
    $('status').textContent = game.air ? 'Steer to spin · centre to land · hold GRAB' : game.message;
    $('action').textContent = game.actionLabel;
    // Keep captured buttons enabled until release; disabling would drop the gesture.
    $('action').disabled = !canAct() && !button?.charging;
    $('brake').textContent = game.air ? 'GRAB' : surf ? 'CARVE' : 'BRAKE';
    $('brake').setAttribute('aria-pressed', String(braking || keys.has('KeyS') || keys.has('ArrowDown')));
    const labels = surf ? ['3 cutbacks', '2 barrels', '2 airs'] : ['Win the race', '5 clean gates', '2 jumps'];
    $('goals').replaceChildren(...labels.map((text, i) => {
      const item = document.createElement('span'); item.textContent = (game.goals[i] ? '✓ ' : '○ ') + text;
      item.className = game.goals[i] ? 'done' : ''; return item;
    }));
    $('finish-score').textContent = game.resultLabel;
    $('finish-detail').textContent = surf ? game.scores.map((n, i) => 'Wave ' + (i + 1) + ': ' + n).join(' · ') + ' · Best flow ×' + game.bestCombo
      : game.jumps + ' jumps · ' + game.falls + ' falls · ' + game.missed + ' missed gates';
    $('wave-score').textContent = surf ? 'Wave ' + game.wave + ': ' + (game.scores.at(-1) ?? 0) + ' points' : '';
    $('best').textContent = best === null ? 'Set your first personal best' : 'Best on this device: ' + (surf ? best + ' pts' : best.toFixed(2) + ' s');
    $('sound').textContent = 'Sound: ' + (sound ? 'on' : 'off');
    $('sound').setAttribute('aria-pressed', String(sound));
  }
  function saveBest() {
    const value = game.total;
    if (best === null || (game.kind === 'surf' ? value > best : value < best)) {
      best = value; try { localStorage.setItem(storageKey(), String(value)); } catch { /* Private browsing can disable storage. */ }
    }
  }
  function start() {
    clear(); dialogs.forEach(d => d.close()); game = new Game({ course: Number($('course').value) });
    loadBest(); game.start(); sync(); view?.resize(); $('court').focus({ preventScroll: true });
  }
  function input() {
    let steer = 0;
    if (mode === 'keyboard') steer = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
    else if (mode === 'touch') steer = stickValue;
    else steer = game.air ? pointerTurn : clamp((pointerLane - game.x) * .9 - game.vx * .13, -1, 1);
    return { steer, brake: braking || keys.has('ArrowDown') || keys.has('KeyS') };
  }
  function loop(now) {
    frame = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000 || 0, .05); last = now;
    mouse.update(now); button.update(now);
    if (keyboard.state) {
      if (!canAct() || keyboard.state.context !== game.context) { keyboard.cancel(); power = 0; }
      else power = keyboard.power(now);
    }
    if (active()) {
      accumulator = Math.min(accumulator + dt, .1);
      while (accumulator >= 1 / 120) { game.step(1 / 120, input()); accumulator -= 1 / 120; }
      if (game.stage === 'finished') { clear(); saveBest(); }
      else if (game.stage === 'between') clear();
    } else accumulator = 0;
    feedback(now);
    if (now > flashUntil) $('feedback').hidden = true;
    if (now >= nextHud) { sync(); nextHud = now + 80; }
    // Charge responds every frame; the less urgent HUD updates at 12.5 Hz.
    $('power').value = power; view.render(game, dt, now / 1000);
  }
  const fire = value => { if (canAct()) game.action(value); power = 0; $('court').focus({ preventScroll: true }); };
  const chargeOptions = {
    enabled: canAct, context: () => game.context, fire,
    progress: value => { if (value !== null) power = value; }, cancelled: () => { power = 0; },
    cancelKey: event => !['ArrowLeft', 'ArrowRight', 'ArrowDown', 'KeyA', 'KeyD', 'KeyS'].includes(event.code),
    allowConcurrent: event => !!event.target.closest?.('#joystick, #brake'),
  };
  mouse = installCharge({ canvas: $('court'), ...chargeOptions });
  button = installCharge({ canvas: $('action'), ...chargeOptions, allowTouch: true });
  $('action').onclick = event => { if (event.detail === 0) fire(.65); };
  $('court').addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || !active()) return;
    const rect = $('court').getBoundingClientRect(); mode = 'mouse';
    pointerLane = view.aimLane(event.clientX, event.clientY);
    pointerTurn = clamp((event.clientX - rect.left - rect.width / 2) / (rect.width * .32), -1, 1);
  });
  $('court').addEventListener('pointerleave', () => { if (mode === 'mouse') { pointerTurn = 0; pointerLane = game.x; } });
  $('brake').addEventListener('pointerdown', event => {
    if (!active() || brakePointer !== null) return;
    event.preventDefault(); brakePointer = event.pointerId; braking = true; $('brake').setPointerCapture(brakePointer);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) $('brake').addEventListener(type, event => {
    if (event.pointerId === brakePointer) { braking = false; brakePointer = null; }
  });
  window.addEventListener('keydown', event => {
    if (isEditing(event.target)) return;
    if (event.code === 'Escape' || event.code === 'KeyP') {
      if ($('pause-dialog').open) $('pause-dialog').close(); else if (active()) $('pause').click(); return;
    }
    if (event.key === '?') { $('help').click(); return; }
    if (!active()) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault();
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'KeyA', 'KeyD', 'KeyS'].includes(event.code)) mode = 'keyboard';
    keys.add(event.code);
    if (event.code === 'Space' && !event.repeat && canAct()) { mouse.cancel(); button.cancel(); keyboard.begin(performance.now(), game.context); }
  });
  window.addEventListener('keyup', event => {
    keys.delete(event.code);
    if (event.code === 'Space') { const value = keyboard.release(performance.now(), canAct() ? game.context : Symbol()); if (value !== null) fire(value); }
  });
  // Switching charge devices cancels the previous unfinished action.
  for (const element of [$('court'), $('action')]) element.addEventListener('pointerdown', () => { keyboard.cancel(); }, true);
  $('start').onclick = start; $('again').onclick = start; $('restart').onclick = start;
  $('next-wave').onclick = () => { clear(); game.continue(); sync(); $('court').focus({ preventScroll: true }); };
  $('sound').onclick = () => { sound = !sound; if (sound) tone('bank'); sync(); };
  $('help').onclick = () => { clear(); $('help-dialog').showModal(); };
  $('pause').onclick = () => { if (active()) { clear(); $('pause-dialog').showModal(); } };
  $('resume').onclick = () => $('pause-dialog').close();
  $('quit').onclick = () => { clear(); $('pause-dialog').close(); game = new Game({ course: Number($('course').value) }); loadBest(); sync(); $('start').focus(); };
  $('course').onchange = () => { game = new Game({ course: Number($('course').value) }); loadBest(); sync(); };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(b.dataset.close).close());
  $('reload').onclick = () => location.reload();
  installLifecycle({ canvas: $('court'), dialogs, clear, active, pause: () => $('pause-dialog').showModal(), fatal });
  observeSurface($('court'), () => view?.resize());
  try {
    await document.fonts.ready; view = new View($('court')); installViews(view, game.kind, clear); $('start').disabled = false;
    loadBest(); sync(); frame = requestAnimationFrame(loop);
  } catch (error) { fatal(error); }
}
