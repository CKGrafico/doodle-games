import { installCharge } from './charge.js';
// One shared mouse affordance for the original collection. Each simulation owns power.
export function sportsMouse({ canvas, game: getGame, active, context, choices = [], secondary, fire, previewPower, restorePower, lockAim = false, racket = false, locale = 'en' }) {
  const hint = locale === 'es' ? 'Mantén clic para cargar · suelta para lanzar' : 'Hold click to charge · release to play';
  let pending = null, token = {}, previousGame, previousContext, saved, charging = false;
  const panel = document.createElement('div'); panel.className = 'mouse-power';
  const label = document.createElement('label'); label.textContent = 'Mouse shot ';
  const select = document.createElement('select'); select.setAttribute('aria-label', 'Mouse shot type');
  for (const [value, text] of choices) { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); }
  if (choices.length) { label.append(select); panel.append(label); }
  const text = document.createElement('span'); text.textContent = hint;
  const meter = document.createElement('meter'); meter.min = 0; meter.max = 1; meter.value = 0; meter.setAttribute('aria-label', 'Mouse shot power'); panel.append(meter, text);
  (document.querySelector('.controls') || document.querySelector('.view-controls')).append(panel);
  const getContext = () => {
    const g = getGame(), state = context(g);
    if (g !== previousGame || state !== previousContext) { token = {}; previousGame = g; previousContext = state; }
    return token;
  };
  const queue = (kind, power) => {
    if (fire) { fire(power); return; }
    const g = getGame(); pending = { kind, power, context: getContext(), until: performance.now() + (racket ? 220 : 250), hit: g.lastHitTime ?? g.lastHit, aim: g.aim ? { ...g.aim } : null };
  };
  const control = installCharge({ canvas, enabled: active, context: getContext,
    cancelKey: e => lockAim || ['Space', 'KeyQ', 'KeyE', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Tab', 'Escape', 'KeyP'].includes(e.code) || e.key === '?',
    aim: e => { if (lockAim) saved = restorePower?.(); },
    secondary: () => { pending = null; secondary(); },
    progress: power => { charging = power !== null; meter.value = power ?? 0; if (power !== null) { previewPower?.(power); text.textContent = `${Math.round(power * 100)}% · ${locale === 'es' ? 'suelta para lanzar · clic derecho cancela' : 'release to play · right click cancels'}`; } else text.textContent = hint; },
    cancelled: () => { if (lockAim && saved) saved(); }, fire: power => queue(select.value, power) });
  select.onchange = () => { control.cancel(); pending = null; canvas.focus(); };
  const cancel = () => { control.cancel(); pending = null; };
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  document.addEventListener('pointerdown', e => { if (e.target !== canvas) pending = null; }, true);
  window.addEventListener('keydown', e => { if (!e.repeat && ['Space', 'KeyE', 'KeyQ', 'KeyF', 'Tab'].includes(e.code)) pending = null; }, true);
  return {
    cancel, update: now => control.update(now), get charging() { return charging; }, get kind() { return select.value; },
    take() {
      if (!pending) return null;
      const g = getGame();
      if (!active() || pending.context !== getContext() || performance.now() > pending.until || racket && pending.hit !== (g.lastHitTime ?? g.lastHit)) { pending = null; return null; }
      const result = pending; if (!racket) pending = null; return result;
    },
  };
}
