import { COURT, Score, Rally, clamp, signOf, sideOf, netHeight, inKitchen } from './rules.js';
export const STEP = 1 / 120;
const G = 9.81, R = COURT.ballRadius;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function seededRandom(seed = 613) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export class PickleballGame {
  constructor({ target = 11, difficulty = 'club', assisted = true, seed = 613 } = {}) {
    this.score = new Score(target); this.difficulty = difficulty; this.assisted = assisted; this.random = seededRandom(seed);
    this.players = Array.from({ length: 4 }, (_, id) => ({ id, team: Math.floor(id / 2), x: 0, z: 0, vx: 0, vz: 0, swing: 0, cooldown: 0, readX: 0, readZ: 0, volley: false }));
    this.ball = { x: 0, y: .65, z: 0, vx: 0, vy: 0, vz: 0 };
    this.aim = { x: -1.4, z: -4.7 }; this.events = []; this.time = 0; this.timer = 0;
    this.bestRally = 0; this.rallyHits = 0; this.totalRallies = 0; this.stats = { hits: [0, 0], dinks: [0, 0], volleys: [0, 0] };
    this.switchLock = 0; this.prepareServe();
  }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drainEvents() { return this.events.splice(0); }
  prepareServe() {
    for (const p of this.players) {
      p.x = (p.id === this.score.right[p.team] ? 1 : -1) * signOf(p.team) * 1.5;
      p.z = signOf(p.team) * 5.8; p.vx = p.vz = p.swing = p.cooldown = 0; p.volley = false;
    }
    const p = this.players[this.score.server]; p.z = signOf(p.team) * 7.15;
    this.receiver = this.score.receiver;
    this.controlled = this.score.team === 0 ? p.id : this.receiver;
    Object.assign(this.ball, { x: p.x, y: .66, z: p.z - signOf(p.team) * .2, vx: 0, vy: 0, vz: 0 });
    this.rally = null; this.rallyHits = 0; this.chaser = null; this.stage = 'ready'; this.timer = 0;
    this.message = this.score.team === 0 ? 'Your serve' : 'District serves'; this.emit('ready');
  }
  serve() {
    if (this.stage !== 'ready') return false;
    const p = this.players[this.score.server];
    this.rally = new Rally(p.team, p.x, this.receiver);
    this.launch({ x: -Math.sign(p.x) * (1.2 + this.random() * .8), z: -signOf(p.team) * 5.2 }, 'serve');
    p.swing = .4; this.stage = 'rally'; this.rallyHits = 1; this.message = 'Serve must bounce';
    this.emit('hit', { kind: 'serve', player: p.id }); return true;
  }
  launch(target, kind, power = .65) {
    const b = this.ball, dx = target.x - b.x, dz = target.z - b.z, length = Math.hypot(dx, dz);
    let flight = kind === 'lob' ? 2.1 : kind === 'dink' ? 1.08 : kind === 'smash' ? clamp(length / 16, .45, 1) : kind === 'serve' ? 1.45 : clamp(length / 10.5, .72, 1.4);
    if (kind !== 'serve') flight /= .7 + clamp(power, 0, 1) * (.3 / .65);
    let vy = (R - b.y + .5 * G * flight * flight) / flight;
    const fraction = -b.z / dz;
    if (fraction > 0 && fraction < 1) for (let i = 0; i < 45; i++) {
      const t = flight * fraction, h = b.y + vy * t - .5 * G * t * t;
      if (h > netHeight(b.x + dx * fraction) + R + .1) break;
      flight += .025; vy = (R - b.y + .5 * G * flight * flight) / flight;
    }
    b.vx = dx / flight; b.vz = dz / flight; b.vy = vy; this.lastHit = this.time; this.chaser = null;
    // One imperfect read per shot, rather than a random failure per frame.
    for (const p of this.players) {
      const chance = { casual: .32, club: .2, pro: .12 }[this.difficulty];
      const error = this.random() < chance ? 2.6 : .13;
      p.readX = (this.random() - .5) * error * 2; p.readZ = (this.random() - .5) * error;
    }
  }
  resolve(result) {
    if (!result || this.stage !== 'rally') return false;
    // A volley cannot be rescued by the ball going dead before the player stops.
    for (const p of this.players) if (p.volley) {
      const forward = Math.max(0, -p.vz * signOf(p.team));
      if (Math.abs(p.z) - COURT.footRadius - forward * forward / 40 <= COURT.kitchen) result = { winner: 1 - p.team, reason: 'Kitchen momentum fault' };
    }
    this.bestRally = Math.max(this.bestRally, this.rallyHits); this.totalRallies++;
    const change = this.score.award(result.winner);
    this.stage = change.match ? 'over' : 'between'; this.timer = 1.9;
    this.message = result.reason; this.ball.vx = this.ball.vy = this.ball.vz = 0;
    this.emit('point', { ...result, ...change }); return true;
  }
  predict() {
    const b = { ...this.ball }; let bounces = this.rally?.bounces ?? 0;
    const needsBounce = this.rally?.mustBounce[1 - this.rally.lastTeam];
    for (let t = 0; t < 2.8; t += .025) {
      b.vy -= G * .025; b.x += b.vx * .025; b.z += b.vz * .025; b.y += b.vy * .025;
      if (b.y <= R) { b.y = R; b.vy = Math.abs(b.vy) * .69; b.vx *= .94; b.vz *= .94; bounces++; }
      if (bounces > 0 && b.y > .45 && b.y < 1.25) return b;
      if (!needsBounce && Math.abs(b.z) > COURT.kitchen + .65 && b.y < 1.7 && b.vy < 0 && t > .1) return b;
      if (bounces >= 2) return b;
    }
    return b;
  }
  move(p, target, speed, dt) {
    const dx = target.x - p.x, dz = target.z - p.z, n = Math.hypot(dx, dz);
    const desired = Math.min(speed, n * 8), vx = n > .03 ? dx / n * desired : 0, vz = n > .03 ? dz / n * desired : 0;
    p.vx += clamp(vx - p.vx, -20 * dt, 20 * dt); p.vz += clamp(vz - p.vz, -20 * dt, 20 * dt);
    p.x = clamp(p.x + p.vx * dt, -4.3, 4.3); p.z = signOf(p.team) * clamp(Math.abs(p.z) + p.vz * signOf(p.team) * dt, .45, 8.7);
    if (p.volley) {
      if (inKitchen(p)) { this.resolve({ winner: 1 - p.team, reason: 'Kitchen momentum fault' }); return; }
      if (p.vz * signOf(p.team) >= -.08) p.volley = false;
    }
  }
  hit(p, kind = 'drive', aim = null, power = .65) {
    if (this.stage !== 'rally' || p.cooldown > 0 || this.time - this.lastHit < .16) return false;
    const b = this.ball;
    if (p.team === this.rally.lastTeam || sideOf(b.z) !== p.team) return false;
    if (distance(p, b) > (p.id === this.controlled ? 1.22 : 1.05) || b.y < .19 || b.y > (kind === 'smash' ? 2.65 : 2.05)) return false;
    const volley = this.rally.bounces === 0;
    const result = this.rally.strike(p); if (this.resolve(result)) return false;
    const opponent = 1 - p.team, s = signOf(opponent);
    let target;
    if (aim && p.team === 0) target = { x: clamp(aim.x, -2.8, 2.8), z: -clamp(Math.abs(aim.z), .9, 6.25) };
    else {
      const others = this.players.filter(q => q.team === opponent), gap = -(others[0].x + others[1].x) * .6;
      target = { x: clamp(gap + (this.random() - .5) * 4.6, -2.75, 2.75), z: s * (4.3 + this.random() * 1.6) };
      const choice = this.random(); kind = choice < .16 ? 'lob' : choice < .45 && Math.abs(p.z) < 4.6 ? 'dink' : b.y > 1.8 && choice > .85 ? 'smash' : 'drive';
    }
    if (kind === 'smash' && b.y < 1.55) kind = 'drive';
    if (kind === 'lob') target.z = s * 5.8;
    if (kind === 'dink') target.z = s * (1.35 + this.random() * .3);
    this.launch(target, kind, power); p.cooldown = .38; p.swing = .4; p.volley = volley;
    this.rallyHits++; this.stats.hits[p.team]++;
    if (volley) this.stats.volleys[p.team]++;
    if (kind === 'dink') this.stats.dinks[p.team]++;
    this.message = this.rally.mustBounce[opponent] ? 'Return must bounce' : kind === 'dink' ? 'Soft hands. Dink!' : 'Rally on';
    this.emit('hit', { kind, player: p.id, volley }); return true;
  }
  updatePlayers(dt, input) {
    const receiving = 1 - this.rally.lastTeam, prediction = this.predict();
    const candidates = this.players.filter(p => p.team === receiving && (!this.rally.serve || p.id === this.receiver));
    if (this.chaser === null) this.chaser = candidates.sort((a, b) => distance(a, prediction) - distance(b, prediction))[0].id;
    if (receiving === 0 && this.assisted && this.switchLock <= 0 && !(input.moveX || input.moveZ)) this.controlled = this.chaser;
    for (const p of this.players) {
      p.cooldown = Math.max(0, p.cooldown - dt); p.swing = Math.max(0, p.swing - dt);
      const human = p.id === this.controlled && !input.autoplay;
      if (human && (input.moveX || input.moveZ)) {
        const n = Math.max(1, Math.hypot(input.moveX, input.moveZ)); this.move(p, { x: p.x + input.moveX / n, z: p.z + input.moveZ / n }, input.sprint ? 6.8 : 5.4, dt);
      } else if (!human || this.assisted) {
        const waitForBounce = this.rally.mustBounce[p.team];
        let target = { x: (p.id === this.score.right[p.team] ? 1 : -1) * signOf(p.team) * 1.55, z: signOf(p.team) * (waitForBounce ? 5.9 : 3.0) };
        if (p.id === this.chaser) {
          target = { x: prediction.x + (human ? 0 : p.readX), z: prediction.z + (human ? 0 : p.readZ) };
          if (this.rally.bounces === 0 && !waitForBounce) target.z = signOf(p.team) * Math.max(Math.abs(target.z), COURT.kitchen + .65);
        }
        this.move(p, target, human ? 5.7 : { casual: 3.4, club: 4.3, pro: 5.1 }[this.difficulty], dt);
      } else this.move(p, p, 0, dt);
      if (this.stage !== 'rally') return;
      if (p.team !== 1 - this.rally.lastTeam) continue;
      if (human) {
        // Held strokes wait through compulsory bounces; kitchen faults remain real.
        if (input.shot && !(this.rally.mustBounce[p.team] && this.rally.bounces === 0)) this.hit(p, input.shot, input.aim, input.power);
      } else if (p.id === this.chaser) {
        const legalVolley = !this.rally.mustBounce[p.team] && !inKitchen(p);
        if ((this.rally.bounces > 0 || legalVolley) && this.time - this.lastHit > .25) this.hit(p);
      }
    }
  }
  step(dt, input = {}) {
    if (this.stage === 'over') return;
    this.time += dt; this.switchLock = Math.max(0, this.switchLock - dt);
    if (input.switch && this.switchLock <= 0) { this.controlled ^= 1; this.switchLock = 1; }
    if (this.stage === 'between') { this.timer -= dt; if (this.timer <= 0) this.prepareServe(); return; }
    if (this.stage === 'ready') { this.timer += dt; if (this.score.team === 0 && !input.autoplay ? input.shot : this.timer > 1.1) this.serve(); return; }
    if (this.stage !== 'rally') return;
    this.updatePlayers(dt, input); if (this.stage !== 'rally') return;
    const b = this.ball, old = { ...b };
    b.vy -= G * dt; b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
    if (old.z * b.z <= 0 && old.z !== b.z) {
      const t = old.z / (old.z - b.z), x = old.x + (b.x - old.x) * t, y = old.y + (b.y - old.y) * t;
      if (Math.abs(x) <= COURT.halfWidth + .16 && y - R <= netHeight(x)) {
        this.emit('net'); this.resolve({ winner: 1 - this.rally.lastTeam, reason: 'Into the net' }); return;
      }
    }
    if (b.y <= R && b.vy < 0) {
      // Judge at floor contact, not at the end of a fast physics step.
      const t = clamp((old.y - R) / (old.y - b.y), 0, 1), x = old.x + (b.x - old.x) * t, z = old.z + (b.z - old.z) * t;
      if (this.resolve(this.rally.floor(x, z))) return;
      b.y = R; b.vy = Math.abs(b.vy) * .69; b.vx *= .94; b.vz *= .94; this.emit('bounce');
    }
    if (Math.abs(b.x) > 10 || Math.abs(b.z) > 15 || this.time - this.lastHit > 10) {
      this.resolve({ winner: this.rally.bounces > 0 ? this.rally.lastTeam : 1 - this.rally.lastTeam, reason: this.rally.bounces > 0 ? 'Unreturned ball' : 'Out' });
    }
  }
}
