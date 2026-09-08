import { collide, slow, clamp, seeded } from '../shared/discs.js';
export const STEP = 1 / 120, R = .115, TABLE = { x: 2.4, z: 4.8, pocket: .27 };
export const POCKETS = [-2.4, 2.4].flatMap(x => [-4.8, 0, 4.8].map(z => ({ x, z })));
export const groupOf = id => id > 0 && id < 8 ? 'solids' : id > 8 ? 'stripes' : null;
const ball = (id, x, z) => ({ id, x, z, vx: 0, vz: 0, r: R, dead: false });
export function rack() {
  const balls = [ball(0, 0, 2.4)], order = [1, 9, 2, 10, 8, 3, 4, 11, 5, 12, 6, 13, 7, 14, 15];
  let n = 0;
  for (let row = 0; row < 5; row++) for (let col = 0; col <= row; col++) balls.push(ball(order[n++], (col - row / 2) * (2 * R + .0005), -2 - row * (Math.sqrt(3) * R + .0005)));
  return balls.sort((a, b) => a.id - b.id);
}
export function legalTargets(balls, group) {
  const ordinary = balls.filter(b => !b.dead && b.id && b.id !== 8 && (!group || groupOf(b.id) === group)).map(b => b.id);
  return ordinary.length ? ordinary : group ? [8] : [];
}
export function resolveShot({ turn, groups, shot, isBreak }) {
  const pots = shot.pots.filter(p => p.id !== 0), eight = pots.find(p => p.id === 8);
  let foul = shot.scratch ? 'Scratch' : shot.first === null ? 'No object-ball contact' : !isBreak && !shot.legal.includes(shot.first) ? 'Wrong ball first' : !pots.length && !shot.rail ? 'No cushion after contact' : '';
  if (isBreak) {
    const illegalBreak = !pots.length && shot.breakRails.size < 4;
    return { turn: foul || illegalBreak || !pots.length ? 1 - turn : turn, groups, foul: illegalBreak ? 'Illegal break: rack restored for opponent' : foul, rerack: illegalBreak, respot: !!eight, hand: !!foul && !illegalBreak, winner: null };
  }
  if (eight) {
    const win = !foul && shot.legal.includes(8) && shot.called === eight.pocket;
    return { turn, groups, winner: win ? turn : 1 - turn, foul: win ? '' : foul || (shot.legal.includes(8) ? 'Eight in an uncalled pocket' : 'Eight pocketed before clearing your group') };
  }
  const nextGroups = [...groups];
  if (!foul && !nextGroups[turn] && pots.length) {
    nextGroups[turn] = groupOf(pots[0].id); nextGroups[1 - turn] = nextGroups[turn] === 'solids' ? 'stripes' : 'solids';
  }
  const ownPot = pots.some(p => groupOf(p.id) === nextGroups[turn]);
  return { turn: !foul && ownPot ? turn : 1 - turn, groups: nextGroups, foul, hand: !!foul, winner: null };
}
function segmentDistance(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, t = clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
export class PoolGame {
  constructor({ local = false, seed = 17 } = {}) {
    this.kind = 'pool'; this.local = local; this.random = seeded(seed); this.balls = rack(); this.turn = 0; this.stage = 'aim';
    this.groups = [null, null]; this.angle = Math.PI; this.power = 1; this.calledPocket = -1; this.shots = 0; this.timer = 0;
    this.isBreak = true; this.placement = { x: 0, z: 2.4 }; this.message = 'Blue breaks. Aim at the rack and give it some weight.'; this.winner = null; this.potted = [0, 0];
  }
  get human() { return this.local || this.turn === 0; }
  get context() { return `${this.shots}:${this.turn}:${this.stage}`; }
  get heading() { return this.angle; }
  set heading(v) { this.angle = Math.atan2(Math.sin(v), Math.cos(v)); }
  left(team) { return this.groups[team] ? this.balls.filter(b => !b.dead && groupOf(b.id) === this.groups[team]).length : 7; }
  aimAt(p) { this.heading = Math.atan2(p.x - this.balls[0].x, p.z - this.balls[0].z); }
  validPlacement(p) {
    return Number.isFinite(p.x) && Number.isFinite(p.z) && Math.abs(p.x) < TABLE.x - R && Math.abs(p.z) < TABLE.z - R && !POCKETS.some(q => Math.hypot(p.x - q.x, p.z - q.z) < TABLE.pocket + R) && !this.balls.some(b => b.id && !b.dead && Math.hypot(b.x - p.x, b.z - p.z) < 2 * R + .005);
  }
  placeCue(p) {
    if (this.stage !== 'place') return false;
    if (!this.validPlacement(p)) { this.message = 'Choose clear cloth, away from balls and pockets.'; return false; }
    Object.assign(this.balls[0], p, { dead: false, vx: 0, vz: 0 }); this.stage = 'aim'; this.timer = 0; this.message = 'Cue ball placed. Choose your shot.'; return true;
  }
  shoot(power = this.power) {
    if (this.stage !== 'aim') return false;
    const legal = legalTargets(this.balls, this.groups[this.turn]);
    if (legal.includes(8) && this.calledPocket < 0 && !this.isBreak) { this.message = 'Call a numbered pocket for the eight first.'; return false; }
    this.power = clamp(power, .05, 1); const speed = 1 + this.power * 11;
    this.balls[0].vx = Math.sin(this.angle) * speed; this.balls[0].vz = Math.cos(this.angle) * speed;
    this.shot = { first: null, legal, called: this.calledPocket, pots: [], rail: false, breakRails: new Set(), scratch: false };
    this.shots++; this.stage = 'rolling'; this.timer = 0; this.message = 'Let the balls settle.'; return true;
  }
  preview() {
    const cue = this.balls[0], key = [this.shots, cue.x, cue.z, this.angle, this.stage].join(':');
    if (key === this.previewKey) return this.prediction;
    this.previewKey = key; const dx = Math.sin(this.angle), dz = Math.cos(this.angle); let length = 20, hit = null;
    for (const b of this.balls) {
      if (!b.id || b.dead) continue;
      const x = b.x - cue.x, z = b.z - cue.z, along = x * dx + z * dz, across2 = x * x + z * z - along * along;
      if (along > 0 && across2 < (2 * R) ** 2) { const t = along - Math.sqrt((2 * R) ** 2 - Math.max(0, across2)); if (t >= 0 && t < length) { length = t; hit = b; } }
    }
    const railX = Math.abs(dx) > 1e-6 ? ((dx > 0 ? TABLE.x - R : -TABLE.x + R) - cue.x) / dx : Infinity;
    const railZ = Math.abs(dz) > 1e-6 ? ((dz > 0 ? TABLE.z - R : -TABLE.z + R) - cue.z) / dz : Infinity;
    if (Math.min(railX, railZ) < length) { length = Math.min(railX, railZ); hit = null; }
    const end = { x: cue.x + dx * length, z: cue.z + dz * length }, path = [{ x: cue.x, z: cue.z }, end];
    if (hit) { const nx = (hit.x - end.x) / (2 * R), nz = (hit.z - end.z) / (2 * R); path.push({ x: hit.x, z: hit.z }, { x: hit.x + nx * .8, z: hit.z + nz * .8 }); }
    this.prediction = { path, end }; return this.prediction;
  }
  physics(dt) {
    // Four microsteps keep maximum travel below one quarter of a ball radius.
    for (let step = 0; step < 4; step++) {
      const h = dt / 4;
      for (const b of this.balls) {
        if (b.dead) continue; slow(b, .42, h); b.x += b.vx * h; b.z += b.vz * h;
        const pocket = POCKETS.findIndex(p => Math.hypot(p.x - b.x, p.z - b.z) < TABLE.pocket);
        if (pocket >= 0) { b.dead = true; b.vx = b.vz = 0; this.shot.pots.push({ id: b.id, pocket }); if (!b.id) this.shot.scratch = true; continue; }
        let rail = false;
        if (Math.abs(b.x) > TABLE.x - R) { b.x = Math.sign(b.x) * (TABLE.x - R); b.vx = -Math.sign(b.x) * Math.abs(b.vx) * .82; rail = true; }
        if (Math.abs(b.z) > TABLE.z - R) { b.z = Math.sign(b.z) * (TABLE.z - R); b.vz = -Math.sign(b.z) * Math.abs(b.vz) * .82; rail = true; }
        if (rail && this.shot.first !== null) { this.shot.rail = true; if (b.id) this.shot.breakRails.add(b.id); }
      }
      for (let i = 0; i < this.balls.length; i++) for (let j = i + 1; j < this.balls.length; j++) {
        if (collide(this.balls[i], this.balls[j], .96) && i === 0 && this.shot.first === null) this.shot.first = this.balls[j].id;
      }
    }
  }
  respotEight() {
    const eight = this.balls[8];
    for (let z = -2.4; z < 4.5; z += .24) {
      const p = { x: 0, z };
      if (!this.balls.some(b => b.id !== 8 && !b.dead && Math.hypot(b.x - p.x, b.z - p.z) < 2 * R + .002)) { Object.assign(eight, p, { dead: false, vx: 0, vz: 0 }); return; }
    }
  }
  finishShot() {
    const shooter = this.turn, result = resolveShot({ turn: this.turn, groups: this.groups, shot: this.shot, isBreak: this.isBreak });
    this.potted[shooter] += this.shot.pots.filter(p => p.id && p.id !== 8).length;
    if (result.respot) this.respotEight();
    this.turn = result.turn; this.groups = result.groups; this.winner = result.winner;
    if (this.winner !== null) { this.stage = 'over'; this.message = `${this.winner === 0 ? 'Blue' : 'Red'} wins the rack.${result.foul ? ' ' + result.foul + '.' : ' Eight in the called pocket!'}`; return; }
    this.isBreak = !!result.rerack;
    if (result.rerack) this.balls = rack();
    this.stage = result.hand ? 'place' : 'aim'; this.timer = 0; this.calledPocket = -1; this.previewKey = null;
    if (result.hand) { this.balls[0].dead = true; this.placement = { x: 0, z: 2.4 }; }
    this.message = result.foul ? `${result.foul}. ${result.rerack ? 'Opponent breaks.' : 'Opponent has ball in hand.'}` : `${this.turn === shooter ? 'Keep shooting.' : 'Next player.'} ${result.respot ? 'Eight respotted.' : ''}`;
  }
  clearPath(a, b, excluded = []) {
    return !this.balls.some(ball => !ball.dead && !excluded.includes(ball.id) && segmentDistance(ball, a, b) < 2 * R + .01);
  }
  plan() {
    if (this.isBreak) { this.angle = Math.PI + .004; this.power = 1; return; }
    const cue = this.balls[0], legal = legalTargets(this.balls, this.groups[this.turn]); let best = null;
    for (const id of legal) for (let pi = 0; pi < POCKETS.length; pi++) {
      const target = this.balls[id], pocket = POCKETS[pi], dist = Math.hypot(pocket.x - target.x, pocket.z - target.z);
      const nx = (pocket.x - target.x) / dist, nz = (pocket.z - target.z) / dist;
      const ghost = { x: target.x - nx * 2 * R, z: target.z - nz * 2 * R };
      const length = Math.hypot(ghost.x - cue.x, ghost.z - cue.z), cosine = ((ghost.x - cue.x) * nx + (ghost.z - cue.z) * nz) / length;
      if (cosine < .22 || Math.abs(ghost.x) >= TABLE.x - R || Math.abs(ghost.z) >= TABLE.z - R || !this.clearPath(cue, ghost, [0, id]) || !this.clearPath(target, pocket, [0, id])) continue;
      const speed = Math.sqrt((2 * .42 * (dist + .45)) / (cosine * cosine * .96) + 2 * .42 * length);
      const cost = length + dist * 1.2 + (1 - cosine) * 10;
      if (speed < 11.8 && (!best || cost < best.cost)) best = { cost, angle: Math.atan2(ghost.x - cue.x, ghost.z - cue.z), power: clamp((speed - 1) / 11, .08, 1), pocket: pi };
    }
    if (best) { this.angle = best.angle; this.power = best.power; this.calledPocket = best.pocket; }
    else {
      const target = legal.map(id => this.balls[id]).sort((a, b) => Math.hypot(a.x - cue.x, a.z - cue.z) - Math.hypot(b.x - cue.x, b.z - cue.z))[0];
      if (target) this.aimAt(target); this.power = .32 + this.random() * .12; this.calledPocket = Math.floor(this.random() * 6);
    }
  }
  aiPlace() {
    for (const id of legalTargets(this.balls, this.groups[this.turn])) for (const pocket of POCKETS) {
      const b = this.balls[id], length = Math.hypot(b.x - pocket.x, b.z - pocket.z);
      const p = { x: b.x + (b.x - pocket.x) / length * .85, z: b.z + (b.z - pocket.z) / length * .85 };
      if (this.validPlacement(p) && this.clearPath(b, pocket, [0, id])) { this.placeCue(p); return; }
    }
    for (let z = -4.4; z < 4.5; z += .35) for (let x = -2; x < 2.1; x += .35) if (this.placeCue({ x, z })) return;
  }
  step(dt = STEP, input = {}) {
    if (this.stage === 'over') return;
    if (this.stage === 'rolling') { this.physics(dt); if (this.balls.every(b => b.dead || Math.hypot(b.vx, b.vz) < .01)) this.finishShot(); return; }
    if ((!this.human || input.autoplay) && (this.timer += dt) > 1) {
      if (this.stage === 'place') this.aiPlace();
      else if (this.stage === 'aim') { this.plan(); this.shoot(); }
    }
  }
}
