import { PetancaGame, STEP, ranking, clamp } from './simulation.js';
const $ = id => document.getElementById(id), keys = new Set();
const dialogs = [$('help-dialog'), $('pause-dialog'), $('result-dialog')];
let game = new PetancaGame(), view, playing = false, previous = 0, accumulator = 0, frameId, sound = false, audio, lastHud = '';
const paused = () => dialogs.some(d => d.open);
const active = () => playing && !paused() && game.turn === 0 && ['aim', 'jack'].includes(game.stage);
function tone(type) {
  if (!sound) return;
  try { audio ??= new AudioContext(); audio.resume(); const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
    o.type = type === 'hit' ? 'triangle' : 'sine'; o.frequency.setValueAtTime(type === 'score' ? 660 : type === 'hit' ? 1400 : 300, t);
    o.frequency.exponentialRampToValueAtTime(type === 'score' ? 880 : 180, t + .14); g.gain.setValueAtTime(.045, t); g.gain.exponentialRampToValueAtTime(.0001, t + .2); o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + .21);
  } catch { sound = false; $('sound').textContent = 'Sonido no disponible'; $('sound').setAttribute('aria-pressed', 'false'); }
}
function clearInput() { keys.clear(); accumulator = 0; }
function sync() {
  const snapshot = [playing, game.stage, game.turn, game.endNumber, ...game.remaining, ...game.scores, game.reach, game.heading, game.mode].join('|');
  if (snapshot === lastHud) return; lastHud = snapshot;
  $('blue-score').textContent = game.scores[0]; $('red-score').textContent = game.scores[1];
  $('end-number').textContent = 'Mano ' + game.endNumber;
  $('remaining').textContent = `Bolas: tú ${game.remaining[0]} · rival ${game.remaining[1]}`;
  const jack = game.stage === 'jack';
  $('status').textContent = jack ? 'Coloca el boliche entre 6 y 10 m.' : game.stage === 'aim' ? 'Tu turno. Busca tu sitio.' : game.stage === 'thinking' ? 'El barrio prepara su lanzamiento…' : game.stage === 'rolling' ? 'A ver dónde queda…' : game.result?.points ? `${game.result.team === 0 ? 'Tú sumas' : 'El barrio suma'} ${game.result.points} ${game.result.points === 1 ? 'punto' : 'puntos'}.` : 'Mano nula. Nadie puntúa.';
  $('aim-controls').disabled = !active(); $('aim-controls').hidden = ['end', 'over'].includes(game.stage);
  $('next').hidden = game.stage !== 'end'; $('aim-title').textContent = jack ? 'Colocación del boliche' : 'Tu lanzamiento';
  $('mode').disabled = jack; $('mode').value = game.mode; $('aim-jack').hidden = jack;
  $('throw').textContent = jack ? 'COLOCAR EL BOLICHE' : 'LANZAR';
  $('reach').min = jack ? 6 : 2; $('reach').max = jack ? 10 : 13; $('reach').value = game.reach;
  $('heading').value = game.heading * 180 / Math.PI; $('heading-value').textContent = (game.heading * 180 / Math.PI).toFixed(1) + '°';
  $('reach-value').textContent = game.reach.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
  const best = ranking(game.balls, game.jack)[0];
  $('measurement').textContent = best && !game.jack.dead && game.stage !== 'rolling' ? `Más cerca: ${best.team === 0 ? 'azul' : 'roja'}, a ${(best.distance * 100).toFixed(1)} cm del centro del boliche.` : 'Toca la pista o ajusta los deslizadores para apuntar.';
}
function start() {
  dialogs.forEach(d => d.close()); clearInput(); game = new PetancaGame({ difficulty: $('difficulty').value, seed: Date.now() });
  playing = true; lastHud = ''; $('lobby').hidden = true; $('match').hidden = false; $('pause').hidden = false; document.body.classList.add('playing'); $('notice').textContent = ''; sync(); view.resize(); $('court').focus({ preventScroll: true });
}
function quit() { dialogs.forEach(d => d.close()); playing = false; clearInput(); game = new PetancaGame(); $('lobby').hidden = false; $('match').hidden = true; $('pause').hidden = true; document.body.classList.remove('playing'); view.close = false; cameraLabel(); view.resize(); $('start').focus(); }
function launch() {
  if (!active()) return;
  if (game.stage === 'jack') {
    if (!game.placeJack()) { $('notice').textContent = 'Acerca el boliche al centro de la pista: debe quedar a más de medio metro del lateral.'; return; }
  } else game.shoot();
  $('notice').textContent = ''; sync();
}
function cameraLabel() { $('camera').textContent = view.close ? 'Ver toda la pista' : 'Acercar al boliche'; $('camera').setAttribute('aria-pressed', String(view.close)); }
function fatal(error) { cancelAnimationFrame(frameId); $('error').hidden = false; $('start').disabled = true; $('start').textContent = 'PISTA NO DISPONIBLE'; console.error(error); }
function animate(now) {
  frameId = requestAnimationFrame(animate); const dt = Math.min((now - previous) / 1000 || 0, .065); previous = now;
  if (playing && !paused()) {
    if (active()) {
      const direction = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), length = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      game.heading = clamp(game.heading + direction * dt * .1, -.4188, .4188);
      game.reach = clamp(game.reach + length * dt * 1.2, game.stage === 'jack' ? 6 : 2, game.stage === 'jack' ? 10 : 13);
    }
    accumulator = Math.min(accumulator + dt, .1); while (accumulator >= STEP) { game.step(STEP); accumulator -= STEP; }
    for (const e of game.drainEvents()) {
      if (['throw', 'hit', 'score'].includes(e.type)) tone(e.type);
      if (e.type === 'out') $('notice').textContent = 'Fuera de la pista.';
      if (e.type === 'score' && e.deadJack) $('notice').textContent = 'El boliche ha salido de la pista.';
      if (e.type === 'score' && game.stage === 'over') {
        $('result-title').textContent = game.scores[0] >= 13 ? '¡La plaza es tuya!' : 'El barrio se lleva esta.';
        $('result-score').textContent = game.scores.join(' : '); $('result-detail').textContent = `${game.endNumber} manos. ¿Echamos otra?`; $('result-dialog').showModal(); clearInput();
      }
    }
  } else accumulator = 0;
  sync(); view.render(game);
}
$('start').onclick = () => view && start(); $('restart').onclick = start; $('rematch').onclick = start; $('quit').onclick = quit;
$('throw').onclick = launch; $('next').onclick = () => { game.nextEnd(); $('notice').textContent = ''; sync(); };
$('aim-jack').onclick = () => { game.aimJack(); sync(); };
for (const id of ['heading', 'reach', 'mode']) $(id).addEventListener('input', () => { if (!active()) return; game.heading = Number($('heading').value) * Math.PI / 180; game.reach = Number($('reach').value); game.mode = $('mode').value; sync(); });
$('help').onclick = () => { clearInput(); $('help-dialog').showModal(); };
$('pause').onclick = () => { if (playing && !paused() && game.stage !== 'over') { clearInput(); $('pause-dialog').showModal(); } };
$('camera').onclick = () => { if (!view) return; view.close = !view.close; cameraLabel(); view.resize(); };
$('sound').onclick = () => { sound = !sound; $('sound').textContent = sound ? 'Sonido: sí' : 'Sonido: no'; $('sound').setAttribute('aria-pressed', String(sound)); tone('throw'); };
$('reload').onclick = () => location.reload();
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(b.dataset.close).close());
dialogs.forEach(d => d.addEventListener('close', () => { clearInput(); lastHud = ''; sync(); }));
window.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { if (!paused()) { e.preventDefault(); $('pause').click(); } return; }
  if (!active() || ['INPUT', 'SELECT', 'BUTTON'].includes(e.target.tagName)) return;
  if (['Space', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(e.code)) { e.preventDefault(); keys.add(e.code); }
  if (e.code === 'Space' && !e.repeat) launch();
});
window.addEventListener('keyup', e => keys.delete(e.code));
function background() { clearInput(); if (playing && !paused() && game.stage !== 'over') $('pause').click(); }
window.addEventListener('blur', background); document.addEventListener('visibilitychange', () => { if (document.hidden) background(); });
window.addEventListener('resize', () => view?.resize());
$('court').addEventListener('pointerdown', e => { if (!view || !active()) return; e.preventDefault(); const p = view.aimAt(e.clientX, e.clientY); if (p) { game.aimAt(p); sync(); } $('court').focus({ preventScroll: true }); });
$('court').addEventListener('webglcontextlost', e => { e.preventDefault(); fatal(new Error('WebGL context lost')); });
try { const { PetancaView } = await import('./render.js'); await document.fonts.ready; view = new PetancaView($('court')); $('start').disabled = false; $('start').textContent = 'ECHAMOS UNA PARTIDA'; requestAnimationFrame(animate); } catch (e) { fatal(e); }
