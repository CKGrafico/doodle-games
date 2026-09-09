export const STEP = 1 / 120;
export const WALL = Object.freeze({ height: 15, width: 4.4 });
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function randomSource(seed = 17) {
  let value = seed >>> 0;
  return () => { value = (1664525 * value + 1013904223) >>> 0; return value / 4294967296; };
}

// Identical lanes use a readable, speed-wall-inspired zig-zag without claiming
// to reproduce the licensed competition hold layout.
export const HOLDS = Object.freeze([
  [0, .35], [-.7, 1.15], [.55, 1.85], [-.2, 2.55], [.82, 3.3], [-.55, 4.05],
  [.2, 4.82], [-.86, 5.62], [.62, 6.38], [-.12, 7.15], [.9, 7.9], [-.58, 8.7],
  [.18, 9.48], [-.82, 10.22], [.68, 11.02], [-.15, 11.82], [.88, 12.58],
  [-.5, 13.32], [.25, 14.05], [0, 15],
].map(([x, y], index) => Object.freeze({ index, x, y })));

export function moveOutcome(from, to, power, grip = 1) {
  const dx = to.x - from.x, dy = to.y - from.y, distance = Math.hypot(dx, dy);
  const reach = .72 + clamp(power, .05, 1) * 1.62;
  const required = clamp((distance - .72) / 1.62, .05, 1);
  const precision = Math.abs(power - required);
  const legal = dy > .05 && distance <= reach + .025 && distance <= 2.36;
  const secure = legal && precision <= .34 + grip * .13;
  return { legal, secure, distance, reach, required, precision };
}

function climber(lane, color) {
  return { lane, color, hold: 0, x: HOLDS[0].x, y: HOLDS[0].y, fromX: HOLDS[0].x,
    fromY: HOLDS[0].y, targetX: HOLDS[0].x, targetY: HOLDS[0].y, moving: 0,
    moveTime: 0, moveDuration: 0, grip: 1, combo: 0, bestCombo: 0, falls: 0, finished: false, time: null };
}

export class ClimbingGame {
  constructor({ difficulty = 'club', seed = 17, local = false } = {}) {
    this.kind = 'climbing'; this.difficulty = difficulty; this.local = local;
    this.random = randomSource(seed); this.stage = 'ready'; this.timer = 0; this.raceTime = 0;
    this.countdown = 2.8; this.target = 1; this.power = .5; this.message = 'Set your feet. Wait for the signal.';
    this.climbers = [climber(0, 'blue'), climber(1, 'red')]; this.winner = null;
    this.falseStart = null; this.events = []; this.races = 0;
  }
  get human() { return true; }
  get context() { return `${this.stage}:${this.climbers[0].hold}:${this.climbers[0].moving}:${this.races}`; }
  get player() { return this.climbers[0]; }
  start() {
    if (this.stage !== 'ready') return false;
    this.stage = 'countdown'; this.timer = this.countdown; this.message = 'Ready…'; this.events.push({ type: 'ready' }); return true;
  }
  select(index) {
    if (this.stage !== 'racing' || this.player.moving) return false;
    const value = Math.round(index); if (!HOLDS[value] || value <= this.player.hold) return false;
    this.target = value; return true;
  }
  aimAt(y) {
    let best = this.player.hold + 1, distance = Infinity;
    for (let i = this.player.hold + 1; i < HOLDS.length; i++) {
      const d = Math.abs(HOLDS[i].y - y); if (d < distance) { distance = d; best = i; }
    }
    return this.select(best);
  }
  falseStartNow() {
    if (this.stage !== 'countdown') return false;
    this.falseStart = 0; this.winner = 1; this.stage = 'finished';
    this.message = 'False start. Red wins this race.'; this.events.push({ type: 'false-start' }); return true;
  }
  move(power = this.power) {
    if (this.stage === 'countdown') return this.falseStartNow();
    const p = this.player;
    if (this.stage !== 'racing' || p.moving || p.finished) return false;
    const target = HOLDS[this.target], outcome = target && moveOutcome(HOLDS[p.hold], target, power, p.grip);
    this.power = clamp(power, .05, 1);
    if (!outcome?.secure) {
      p.falls++; p.combo = 0; p.grip = clamp(p.grip - .13, .1, 1); p.moving = -1; p.moveDuration = p.moveTime = .48;
      this.message = outcome?.legal ? 'Fingertips slipped. Recover!' : 'That hold is out of reach. Recover!';
      this.events.push({ type: 'fall' }); return false;
    }
    p.fromX = p.x; p.fromY = p.y; p.targetX = target.x; p.targetY = target.y;
    p.moving = 1; p.moveDuration = p.moveTime = .16 + outcome.distance * .12;
    p.grip = clamp(p.grip - (.025 + outcome.distance * .018 + Math.max(0, this.power - outcome.required) * .08), 0, 1);
    p.combo++; p.bestCombo = Math.max(p.bestCombo, p.combo); this.message = p.combo > 2 ? `Flow ×${p.combo}` : 'Hold! Pick the next move.';
    this.events.push({ type: 'move', hold: target.index, power: this.power }); return true;
  }
  updateClimber(p, dt) {
    if (!p.moving) { p.grip = clamp(p.grip + dt * .018, 0, 1); return; }
    p.moveTime -= dt;
    if (p.moving < 0) {
      p.y = Math.max(HOLDS[p.hold].y - Math.sin(clamp(1 - p.moveTime / p.moveDuration, 0, 1) * Math.PI) * .45, .3);
      if (p.moveTime <= 0) { p.moving = 0; p.y = HOLDS[p.hold].y; this.target = Math.min(p.hold + 1, HOLDS.length - 1); }
      return;
    }
    const progress = clamp(1 - p.moveTime / p.moveDuration, 0, 1), eased = 1 - (1 - progress) ** 2;
    p.x = p.fromX + (p.targetX - p.fromX) * eased; p.y = p.fromY + (p.targetY - p.fromY) * eased;
    if (p.moveTime <= 0) {
      p.moving = 0; p.hold = HOLDS.findIndex(h => h.x === p.targetX && h.y === p.targetY);
      p.x = p.targetX; p.y = p.targetY; if (p === this.player) this.target = Math.min(p.hold + 1, HOLDS.length - 1);
      if (p.hold === HOLDS.length - 1) this.finish(p);
    }
  }
  aiMove() {
    const p = this.climbers[1]; if (p.moving || p.finished) return;
    const skill = { casual: .72, club: .83, pro: .94 }[this.difficulty] ?? .83;
    const skip = this.random() < skill * .42 && p.hold < HOLDS.length - 2 ? 2 : 1;
    const target = HOLDS[p.hold + skip], outcome = moveOutcome(HOLDS[p.hold], target, 1, p.grip);
    if (!outcome.legal || this.random() > skill + .045) { p.falls++; p.combo = 0; p.moving = -1; p.moveDuration = p.moveTime = .38; return; }
    p.fromX = p.x; p.fromY = p.y; p.targetX = target.x; p.targetY = target.y; p.moving = 1;
    p.moveDuration = p.moveTime = (.16 + outcome.distance * .12) / (.82 + skill * .25); p.grip = clamp(p.grip - .035, .2, 1); p.combo++;
  }
  finish(p) {
    p.finished = true; p.time = this.raceTime; this.events.push({ type: 'finish', lane: p.lane, time: p.time });
    if (this.winner === null) { this.winner = p.lane; this.stage = 'finished'; this.races++; this.message = `${p.lane === 0 ? 'Blue' : 'Red'} hits the pad first in ${p.time.toFixed(2)} s.`; }
  }
  step(dt = STEP, input = {}) {
    if (this.stage === 'ready' || this.stage === 'finished') return;
    if (this.stage === 'countdown') {
      this.timer -= dt;
      if (input.move) { this.falseStartNow(); return; }
      if (this.timer <= 0) { this.stage = 'racing'; this.timer = 0; this.message = 'GO!'; this.events.push({ type: 'go' }); }
      return;
    }
    this.raceTime += dt; this.updateClimber(this.player, dt); this.updateClimber(this.climbers[1], dt);
    if (this.stage !== 'racing') return;
    const cadence = { casual: .49, club: .4, pro: .33 }[this.difficulty] ?? .4;
    this.timer += dt; if (this.timer >= cadence) { this.timer = 0; this.aiMove(); }
    if (input.move) this.move(input.power);
  }
  drainEvents() { return this.events.splice(0); }
}
