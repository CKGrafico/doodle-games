import { collide, slow, clamp, seeded } from '../shared/discs.js';
export const STEP = 1 / 120, R = .22;
export const SHEET = { halfWidth: 2.375, release: 8.5, house: -6.8, houseR: 1.83, hog: -1.5, back: -8.85 };
export function scoreEnd(stones) {
  const ranked = stones.filter(s => !s.dead && Math.hypot(s.x, s.z - SHEET.house) <= SHEET.houseR + R)
    .map(s => ({ ...s, distance: Math.hypot(s.x, s.z - SHEET.house) })).sort((a, b) => a.distance - b.distance);
  if (!ranked.length) return { team: null, points: 0 };
  const other = ranked.find(s => s.team !== ranked[0].team), limit = other?.distance ?? Infinity;
  return { team: ranked[0].team, points: ranked.filter(s => s.team === ranked[0].team && s.distance < limit - .001).length };
}
export function slide(s, dt, sweep = false) {
  if (s.dead) return;
  const speed = Math.hypot(s.vx, s.vz);
  if (speed > .03 && s.curl) {
    const angle = s.curl * .013 * (sweep ? .3 : 1) * dt;
    const vx = s.vx; s.vx = vx * Math.cos(angle) - s.vz * Math.sin(angle); s.vz = vx * Math.sin(angle) + s.vz * Math.cos(angle);
  }
  slow(s, sweep ? .39 : .5, dt); s.x += s.vx * dt; s.z += s.vz * dt;
  if (Math.abs(s.x) + R >= SHEET.halfWidth || s.z + R < SHEET.back || s.z > 10) { s.dead = true; s.vx = s.vz = 0; }
}
export function delivery(power, angle, curl = 1) {
  const speed = 1.2 + clamp(power, .05, 1) * 4.2;
  return { x: 0, z: SHEET.release, vx: Math.sin(angle) * speed, vz: -Math.cos(angle) * speed, curl, r: R, dead: false };
}
export function trajectory(power, angle, curl, sweep = false) {
  const stone = delivery(power, angle, curl), path = [{ x: stone.x, z: stone.z }];
  for (let i = 0; i < 1600 && !stone.dead && Math.hypot(stone.vx, stone.vz) > .01; i++) {
    slide(stone, STEP, sweep); if (i % 12 === 0) path.push({ x: stone.x, z: stone.z });
  }
  path.push({ x: stone.x, z: stone.z }); return { path, end: stone };
}
export class CurlingGame {
  constructor({ ends = 3, seed = 17, local = false } = {}) {
    this.kind = 'curling'; this.ends = Number(ends); this.local = local; this.random = seeded(seed);
    this.scores = [0, 0]; this.hammer = 0; this.endNumber = 0; this.history = []; this.shots = 0; this.nextEnd();
  }
  get human() { return this.local || this.turn === 0; }
  get context() { return `${this.endNumber}:${this.shots}:${this.stage}:${this.turn}`; }
  get heading() { return this.angle; }
  set heading(v) { this.angle = clamp(v, -.24, .24); }
  nextEnd() {
    if (this.endNumber && this.stage !== 'end') return;
    this.endNumber++; this.stones = []; this.remaining = [8, 8]; this.turn = 1 - this.hammer;
    this.stage = 'aim'; this.timer = 0; this.angle = -.035; this.power = .65; this.curl = 1;
    this.message = 'Draw to the button, protect with a guard, or play a take-out.';
  }
  aimAt(p) { this.heading = Math.atan2(p.x, SHEET.release - p.z); }
  shoot(power = this.power) {
    if (this.stage !== 'aim' || !this.remaining[this.turn]) return false;
    this.power = clamp(power, .05, 1); this.before = this.stones.map(s => ({ ...s }));
    this.protected = this.stones.filter(s => !s.dead && s.team !== this.turn && s.z > SHEET.house && s.z < SHEET.hog && Math.hypot(s.x, s.z - SHEET.house) > SHEET.houseR + R).map(s => s.id);
    this.active = { ...delivery(this.power, this.angle, this.curl), id: this.shots++, team: this.turn };
    this.stones.push(this.active); this.remaining[this.turn]--; this.stage = 'rolling'; this.timer = 0; this.touched = false;
    this.message = 'Sweep to travel farther and curl less.'; return true;
  }
  preview() {
    const key = [this.power, this.angle, this.curl].join(':');
    if (this.previewKey !== key) { this.previewKey = key; this.prediction = trajectory(this.power, this.angle, this.curl); }
    return this.prediction;
  }
  finishShot() {
    let notice = '';
    if (!this.active.dead && this.active.z + R >= SHEET.hog && !this.touched) { this.active.dead = true; notice = 'Short of the hog line. Stone removed.'; }
    const delivered = 16 - this.remaining[0] - this.remaining[1];
    if (delivered <= 5 && this.protected.some(id => this.stones.find(s => s.id === id)?.dead)) {
      this.stones = this.before; this.active.dead = true; this.stones.push(this.active); notice = 'Free guard violation. Guard restored; delivered stone removed.';
    }
    if (this.remaining.every(n => n === 0)) {
      const result = scoreEnd(this.stones); if (result.points) { this.scores[result.team] += result.points; this.hammer = 1 - result.team; }
      this.history.push(result); this.stage = this.endNumber >= this.ends && this.scores[0] !== this.scores[1] ? 'over' : 'end';
      this.message = result.points ? `${result.team === 0 ? 'Blue' : 'Red'} scores ${result.points}.` : 'Blank end. Hammer stays.';
      if (this.stage === 'over') this.message += ` ${this.scores[0] > this.scores[1] ? 'Blue' : 'Red'} wins!`;
      else if (this.endNumber >= this.ends) this.message += ' Tied: play an extra end.';
    } else { this.turn = 1 - this.turn; this.stage = 'aim'; this.timer = 0; this.message = notice || 'Next delivery. Read the stones in the house.'; }
  }
  plan() {
    // Search the same unopposed delivery physics used by the visible preview.
    const ranked = this.stones.filter(s => !s.dead && s.team !== this.turn).sort((a, b) => Math.hypot(a.x, a.z - SHEET.house) - Math.hypot(b.x, b.z - SHEET.house));
    const target = ranked[0] && this.remaining[this.turn] < 6 ? ranked[0] : { x: (this.random() - .5) * .9, z: SHEET.house + (this.random() - .5) * .6 };
    const takeout = target.id !== undefined; this.curl = this.random() > .5 ? 1 : -1;
    let best = Infinity, selected;
    for (let ai = -12; ai <= 12; ai++) for (let pi = 52; pi <= 78; pi += 2) {
      const angle = ai * .01, power = pi / 100, path = trajectory(power, angle, this.curl);
      const value = path.end.dead ? 100 : Math.hypot(path.end.x - target.x, path.end.z - target.z);
      if (value < best) { best = value; selected = { angle, power }; }
    }
    this.angle = selected.angle + (this.random() - .5) * .006; this.power = Math.min(1, selected.power + (takeout ? .065 : 0));
  }
  step(dt = STEP, input = {}) {
    if (this.stage === 'aim') {
      if ((!this.human || input.autoplay) && (this.timer += dt) > .9) { this.plan(); this.shoot(); } return;
    }
    if (this.stage !== 'rolling') return;
    this.timer += dt; this.sweeping = !!input.sweep && this.human && !this.active.dead && this.active.z > SHEET.house;
    for (const s of this.stones) slide(s, dt, s === this.active && this.sweeping);
    for (let i = 0; i < this.stones.length; i++) for (let j = i + 1; j < this.stones.length; j++) {
      if (collide(this.stones[i], this.stones[j], .9)) { if ([this.stones[i], this.stones[j]].includes(this.active)) this.touched = true; }
    }
    if (this.stones.every(s => s.dead || Math.hypot(s.vx, s.vz) < .01)) { this.sweeping = false; this.finishShot(); }
  }
}
