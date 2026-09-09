import { installTouchAim, observeSurface } from './touch.js';
import { isEditing, installLifecycle } from './controls.js';
import { installCharge } from './charge.js';
const $ = id => document.getElementById(id);
export async function boot({ create, loadView, kind }) {
  let game = create(), view, playing = false, frame, last = 0, acc = 0, sweeping = false, mouse, chargePower = null;
  const keys = new Set(), dialogs = [$('help-dialog'), $('pause-dialog')], paused = () => dialogs.some(d => d.open);
  const active = () => playing && !paused() && game.stage !== 'over';
  const canAim = () => active() && game.human && game.stage === 'aim';
  const clear = () => { keys.clear(); sweeping = false; mouse?.cancel(); acc = 0; };
  const fatal = error => { clear(); playing = false; cancelAnimationFrame(frame); $('start').disabled = true; $('error').hidden = false; console.error(error); };
  function primary() {
    if (!active() || !game.human) return;
    if (game.stage === 'place') game.placeCue(game.placement); else if (game.stage === 'aim') game.shoot(game.power);
    clear(); sync();
  }
  function sync() {
    $('lobby').hidden = playing; $('match').hidden = !playing; $('pause').hidden = !playing; document.body.classList.toggle('playing', playing);
    const blue = kind === 'curling' ? game.scores[0] : game.groups[0] || 'Open';
    const red = kind === 'curling' ? game.scores[1] : game.groups[1] || 'Open';
    $('blue-score').textContent = blue; $('red-score').textContent = red;
    $('turn').textContent = game.stage === 'over' ? 'Match complete' : game.human ? `${game.turn === 0 ? 'Blue' : 'Red'}: your turn` : 'Red is thinking…';
    if (game.stage === 'rolling') $('turn').textContent = `${game.turn === 0 ? 'Blue' : 'Red'} ${kind === 'curling' ? 'stone sliding' : 'shot in motion'}`;
    $('status').textContent = game.message;
    $('detail').textContent = kind === 'curling' ? `End ${game.endNumber} / ${game.ends} · Hammer: ${game.hammer === 0 ? 'blue' : 'red'}\nStones left: ${game.remaining.join(' / ')}` : `${game.left(0)} / ${game.left(1)} balls left · ${game.isBreak ? 'Break shot' : game.stage === 'place' ? 'Ball in hand' : 'Clear your group, then the eight'}`;
    $('history').textContent = kind === 'curling' ? game.history.map((r, i) => `${i + 1}: ${r.points ? (r.team === 0 ? 'B' : 'R') + '+' + r.points : 'blank'}`).join(' · ') : game.balls.filter(b => b.dead && b.id).map(b => b.id).join(' · ');
    $('shot-controls').disabled = !canAim(); $('power').value = Math.round(game.power * 100); $('angle').value = game.angle * 180 / Math.PI;
    $('power-value').textContent = `${Math.round((chargePower ?? game.power) * 100)}%`; $('power-fill').style.width = `${(chargePower ?? game.power) * 100}%`;
    $('next').hidden = game.stage !== 'end'; $('again').hidden = game.stage !== 'over';
    $('placement').hidden = !(game.stage === 'place' && game.human); $('place-x').value = game.placement?.x ?? 0; $('place-z').value = game.placement?.z ?? 0;
    if (kind === 'curling') { $('curl').value = game.curl; $('sweep').hidden = !playing || !game.human || game.stage !== 'rolling'; $('sweep').setAttribute('aria-pressed', String(sweeping || keys.has('Space'))); }
    else { $('pocket').value = game.calledPocket; }
  }
  function start() {
    clear(); dialogs.forEach(d => d.close()); game = create({ local: $('opponent').value === 'local', ends: Number($('length').value), seed: Date.now() });
    playing = true; view.close = false; sync(); view.resize(); $('court').focus();
  }
  function aim(e) { if (!view) return; const p = view.aimAt(e.clientX, e.clientY); if (!p) return;
    if (canAim() && !mouse?.charging) game.aimAt(p);
    else if (active() && game.human && game.stage === 'place') game.placement = { x: Math.max(-2.2, Math.min(2.2, p.x)), z: Math.max(-4.6, Math.min(4.6, p.z)) };
  }
  function loop(now) {
    frame = requestAnimationFrame(loop); const dt = Math.min((now - last) / 1000 || 0, .06); last = now; mouse.update(now);
    if (active()) {
      if (canAim() && !mouse.charging) {
        const direction = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
        const power = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
        game.heading = game.angle + direction * dt * (kind === 'curling' ? .04 : .65); game.power = Math.max(.05, Math.min(1, game.power + power * dt * .3));
      }
      acc = Math.min(acc + dt, .1); while (acc >= 1 / 120) { game.step(1 / 120, { sweep: sweeping || keys.has('Space') }); acc -= 1 / 120; }
    } else acc = 0;
    sync(); view.render(game, now / 1000);
  }
  $('start').onclick = start; $('again').onclick = start; $('restart').onclick = start;
  $('hit').onclick = primary; $('place').onclick = primary;
  $('next').onclick = () => { clear(); game.nextEnd(); sync(); };
  $('help').onclick = () => { clear(); $('help-dialog').showModal(); };
  $('pause').onclick = () => { if (active()) { clear(); $('pause-dialog').showModal(); } };
  $('resume').onclick = () => $('pause-dialog').close();
  $('quit').onclick = () => { clear(); $('pause-dialog').close(); playing = false; sync(); $('start').focus(); };
  $('reload').onclick = () => location.reload();
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(b.dataset.close).close());
  $('camera').onclick = () => { if (!view) return; clear(); view.close = !view.close; view.resize(); $('camera').textContent = view.close ? 'Camera: close' : 'Camera: overview'; };
  $('power').oninput = e => { if (canAim()) game.power = Number(e.target.value) / 100; };
  $('angle').oninput = e => { if (canAim()) game.heading = Number(e.target.value) * Math.PI / 180; };
  for (const axis of ['x', 'z']) $('place-' + axis).oninput = e => { if (active() && game.human && game.stage === 'place') game.placement[axis] = Number(e.target.value); };
  const secondary = () => { if (!canAim()) return; if (kind === 'curling') game.curl *= -1; else game.calledPocket = (game.calledPocket + 1) % 6; };
  if (kind === 'curling') {
    $('curl').onchange = e => { if (canAim()) game.curl = Number(e.target.value); };
    const button = $('sweep'); button.onpointerdown = e => { if (!active() || !game.human || game.stage !== 'rolling') return; e.preventDefault(); sweeping = true; button.setPointerCapture(e.pointerId); };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => sweeping = false);
    $('court').addEventListener('pointermove', e => { if (game.stage === 'rolling' && game.human && e.buttons === 1) sweeping = true; });
    window.addEventListener('pointerup', () => sweeping = false);
    window.addEventListener('pointercancel', () => sweeping = false);
  } else $('pocket').onchange = e => { if (canAim()) game.calledPocket = Number(e.target.value); };
  window.addEventListener('keydown', e => {
    if (isEditing(e.target)) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { $('pause').click(); return; }
    if (e.key === '?') { $('help').click(); return; }
    if (!active()) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); keys.add(e.code);
    if (e.code === 'Space' && !e.repeat && game.stage !== 'rolling') primary();
    if (e.code === 'KeyE' && !e.repeat) secondary();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  $('court').addEventListener('pointermove', e => { if (e.pointerType !== 'touch') aim(e); });
  $('court').addEventListener('pointerdown', e => { if (e.pointerType !== 'touch' && game.stage === 'place') { aim(e); $('court').focus({ preventScroll: true }); } });
  $('court').addEventListener('wheel', e => { if (canAim() && !mouse.charging) { e.preventDefault(); game.power = Math.max(.05, Math.min(1, game.power - Math.sign(e.deltaY) * .02)); } }, { passive: false });
  let beforePower;
  mouse = installCharge({ canvas: $('court'), enabled: canAim, context: () => game.context, aim, secondary,
    progress: power => { if (power !== null && chargePower === null) beforePower = game.power; chargePower = power; if (power !== null) game.power = power; $('match').classList.toggle('charging', power !== null); },
    cancelled: () => { if (beforePower !== undefined) game.power = beforePower; },
    fire: power => { game.shoot(power); sync(); } });
  installLifecycle({ canvas: $('court'), dialogs, clear, active, pause: () => $('pause').click(), fatal });
  installTouchAim({ canvas: $('court'), active: () => canAim() || (active() && game.human && game.stage === 'place'), aim });
observeSurface($('court'), () => view?.resize());
window.addEventListener('resize', () => view?.resize());
  try { const View = await loadView(); await document.fonts.ready; view = new View($('court')); $('start').disabled = false; sync(); frame = requestAnimationFrame(loop); } catch (error) { fatal(error); }
}
