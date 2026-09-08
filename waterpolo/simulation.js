import { POOL, FORMATION, clamp, distance, attackDirection, classifyBall, shotClockExpired } from './rules.js';
export const STEP = 1 / 60;
export function seededRandom(seed = 17) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n; return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
export class WaterPoloGame {
  constructor({ duration = 240, difficulty = 'club', assisted = true, seed = 17 } = {}) {
    this.duration = Number(duration); this.difficulty = difficulty; this.assisted = assisted; this.random = seededRandom(seed);
    this.players = Array.from({ length: 14 }, (_, id) => ({ id, team: id < 7 ? 0 : 1, keeper: id % 7 === 0, x: 0, z: 0, vx: 0, vz: 0, facing: 0, cooldown: 0, decision: 0, stroke: 0, stamina: 1 }));
    this.goals = [0, 0]; this.stats = { shots: [0, 0], passes: [0, 0], saves: [0, 0], steals: [0, 0] };
    this.quarter = 1; this.elapsed = 0; this.time = 0; this.controlled = 4; this.events = []; this.restart(0, 'swim-off');
  }
  d(team) { return attackDirection(team); }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drainEvents() { return this.events.splice(0); }
  hold(p) {
    this.ball = { x: p.x, y: .52, z: p.z, vx: 0, vy: 0, vz: 0, owner: p.id };
    this.lastTouch = p.team; this.possessionTeam = p.team;
  }
  restart(team, reason = 'restart') {
    for (const p of this.players) {
      const d = this.d(p.team), f = FORMATION[p.id % 7 - 1];
      p.x = p.keeper ? 0 : f[0]; p.z = p.keeper ? -d * 13.7 : -d * Math.max(2, f[1]);
      p.vx = p.vz = 0; p.cooldown = 0; p.decision = .6; p.facing = Math.atan2(0, d);
    }
    const p = this.players[team * 7 + 4]; p.x = 0; p.z = -this.d(team) * .4;
    this.hold(p); this.possession = 30; this.lastThrow = null; this.controlled = team === 0 ? p.id : 4;
    this.stage = 'restart'; this.timer = reason === 'swim-off' ? 1.2 : .8; this.message = reason === 'goal' ? 'Back to halfway' : 'Swim-off';
  }
  move(p, target, speed, dt) {
    const dx = target.x - p.x, dz = target.z - p.z, length = Math.hypot(dx, dz), amount = Math.min(length, speed * dt), ox = p.x, oz = p.z;
    if (length > .03) { p.x += dx / length * amount; p.z += dz / length * amount; p.facing = Math.atan2(dx, dz); }
    p.x = clamp(p.x, -9.5, 9.5); p.z = clamp(p.z, -14.3, 14.3); p.vx = (p.x - ox) / dt; p.vz = (p.z - oz) / dt; p.stroke += Math.hypot(p.vx, p.vz) * dt;
  }
  target(p, kind, aim) {
    const mates = this.players.filter(q => q.team === p.team && !q.keeper && q.id !== p.id);
    const value = q => {
      const space = Math.min(...this.players.filter(r => r.team !== p.team).map(r => distance(r, q)));
      return (q.z - p.z) * this.d(p.team) * .7 + space * 1.4 - distance(q, p) * .15 - (aim ? distance(q, aim) * 3 : 0);
    };
    return mates.sort((a, b) => value(b) - value(a))[0];
  }
  throw(p, kind = 'pass', aim = null, power = .7) {
    if (this.ball.owner !== p.id) return false;
    const d = this.d(p.team), shoot = kind === 'shoot', q = shoot ? null : this.target(p, kind, aim), keeper = this.players[(1 - p.team) * 7];
    const tx = shoot ? (aim ? clamp(aim.x, -1.16, 1.16) : -Math.sign(keeper.x || this.random() - .5) * 1.02) : clamp(q.x + q.vx * .2, -9.2, 9.2);
    const tz = shoot ? d * 15.5 : clamp(q.z + d * (kind === 'lead' ? 1.8 : 0), -13, 13), dx = tx - p.x, dz = tz - p.z, length = Math.hypot(dx, dz) || 1;
    const speed = shoot ? 15 + clamp(power, 0, 1) * 7 : kind === 'lead' ? 13 : 11, flight = Math.max(.05, (length - .65) / speed);
    // Passes arrive at hand height; shots arrive below the crossbar.
    const vy = ((shoot ? .42 : .65) - .65 + 2.75 * flight * flight) / flight;
    this.ball = { x: p.x + dx / length * .65, y: .65, z: p.z + dz / length * .65, vx: dx / length * speed, vy, vz: dz / length * speed, owner: null };
    p.cooldown = .6; this.lastTouch = p.team; this.lastThrow = p.id; this.throwTime = this.time; this.stats[shoot ? 'shots' : 'passes'][p.team]++;
    this.stage = 'play'; this.emit('throw', { team: p.team, kind }); return true;
  }
  gain(p) {
    // A same-team catch does not buy another thirty seconds.
    if (this.possessionTeam !== p.team) this.possession = 30;
    this.hold(p); p.cooldown = .9; p.decision = .35; if (p.team === 0) this.controlled = p.id; this.emit('possession', { team: p.team });
  }
  steal(p) {
    const owner = this.players[this.ball.owner];
    if (!owner || owner.team === p.team || p.cooldown > 0 || owner.cooldown > 0 || distance(p, owner) > 1.25) return false;
    owner.cooldown = 1.5; this.stats.steals[p.team]++; this.gain(p); this.emit('steal', { team: p.team }); return true;
  }
  goal(team) {
    this.goals[team]++; this.stage = 'goal'; this.timer = 2.4; this.scoring = team; this.message = team === 0 ? 'WHAT A GOAL!' : 'District scores'; this.emit('goal', { team });
  }
  loose(dt) {
    const b = this.ball, old = { ...b }; b.vy -= 5.5 * dt; b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
    if (b.y < POOL.ballRadius) { b.y = POOL.ballRadius; b.vy = Math.abs(b.vy) * .18; b.vx *= Math.exp(-1.4 * dt); b.vz *= Math.exp(-1.4 * dt); }
    // Swept full-ball crossing includes height, so shots above the bar miss.
    for (const end of [-1, 1]) {
      const plane = end * (POOL.halfLength + POOL.ballRadius);
      if ((old.z - plane) * (b.z - plane) <= 0 && (b.z - old.z) * end > 0) {
        const t = (plane - old.z) / (b.z - old.z), result = classifyBall({ x: old.x + (b.x - old.x) * t, y: old.y + (b.y - old.y) * t, z: plane + end * .001 });
        if (result.type === 'goal') this.goal(result.team); else this.turnover(result.team); return;
      }
    }
    const result = classifyBall(b);
    if (result) { if (result.type === 'goal') this.goal(result.team); else this.turnover(result.team ?? 1 - this.lastTouch); return; }
    for (const p of [...this.players].sort((a, c) => distance(a, b) - distance(c, b))) {
      if ((p.id === this.lastThrow && this.time - this.throwTime < .6) || p.cooldown > 0) continue;
      if (distance(p, b) < (p.keeper ? .88 : .8) && b.y < 1.25) {
        if (p.keeper && p.team !== this.lastTouch) { this.stats.saves[p.team]++; this.emit('save', { team: p.team }); }
        this.gain(p); break;
      }
    }
  }
  turnover(team) {
    const p = this.players[team * 7]; p.x = 0; p.z = -this.d(team) * 13.7; this.hold(p); this.possession = 30; p.decision = .45; p.cooldown = .8;
    this.stage = 'restart'; this.timer = .65; this.message = 'Turnover'; if (team === 0) this.controlled = p.id; this.emit('whistle', { team });
  }
  updatePlayers(dt, input) {
    const b = this.ball, carrier = this.players[b.owner], teamWithBall = carrier?.team ?? this.possessionTeam;
    const expected = { x: clamp(b.x + b.vx * .25, -9.3, 9.3), z: clamp(b.z + b.vz * .25, -14, 14) };
    const nearest = [0, 1].map(team => this.players.filter(p => p.team === team && !p.keeper && p.id !== b.owner).sort((a, c) => distance(a, expected) - distance(c, expected)));
    for (const p of this.players) {
      p.cooldown = Math.max(0, p.cooldown - dt); p.decision -= dt;
      const human = p.id === this.controlled && !input.autoplay, d = this.d(p.team), isCarrier = this.ball.owner === p.id;
      let speed = p.team === 0 ? 3.15 : { casual: 2.45, club: 2.85, pro: 3.15 }[this.difficulty];
      if (human && input.sprint && p.stamina > .05) { speed *= 1.35; p.stamina = Math.max(0, p.stamina - dt * .12); } else p.stamina = Math.min(1, p.stamina + dt * .07);
      if (human && (input.moveX || input.moveZ)) {
        const n = Math.max(1, Math.hypot(input.moveX, input.moveZ)); this.move(p, { x: p.x + input.moveX / n, z: p.z + input.moveZ / n }, speed, dt);
      } else if (p.keeper) this.move(p, { x: clamp(b.x * .35, -1.15, 1.15), z: -d * 13.65 }, 2.6, dt);
      else if (human && !this.assisted) p.vx = p.vz = 0;
      else {
        let target;
        if (isCarrier) target = { x: clamp(p.x * .8, -4, 4), z: d * 11.5 };
        else if ((!carrier || teamWithBall !== p.team) && nearest[p.team][0] === p) target = expected;
        else { const f = FORMATION[p.id % 7 - 1], attack = teamWithBall === p.team; target = { x: clamp(f[0] * .75 + b.x * .15, -8, 8), z: clamp(b.z + d * (attack ? 5 - f[1] * .6 : -5 - f[1] * .3), -12, 12) }; }
        this.move(p, target, speed, dt);
      }
      if (isCarrier && !human && p.decision <= 0) {
        const range = distance(p, { x: 0, z: d * 15 }), pressure = Math.min(...this.players.filter(q => q.team !== p.team).map(q => distance(q, p)));
        if (!p.keeper && (range < 9 || this.possession < 3)) this.throw(p, 'shoot');
        else if (p.keeper || pressure < 2 || this.random() < .15) this.throw(p, this.random() < .25 ? 'lead' : 'pass');
        p.decision = .45 + this.random() * .4;
      }
      if (!human && this.players[this.ball.owner]?.team !== p.team) this.steal(p);
    }
    for (let i = 0; i < this.players.length; i++) for (let j = i + 1; j < this.players.length; j++) {
      const a = this.players[i], b = this.players[j], dx = b.x - a.x, dz = b.z - a.z, n = Math.hypot(dx, dz);
      if (n > .001 && n < .95) { const push = (.95 - n) * .2; a.x = clamp(a.x - dx / n * push, -9.5, 9.5); a.z = clamp(a.z - dz / n * push, -14.3, 14.3); b.x = clamp(b.x + dx / n * push, -9.5, 9.5); b.z = clamp(b.z + dz / n * push, -14.3, 14.3); }
    }
  }
  step(dt, input = {}) {
    if (this.stage === 'over') return; this.time += dt;
    if (this.stage === 'goal' || this.stage === 'quarter') {
      this.timer -= dt; if (this.timer <= 0) this.restart(this.stage === 'goal' ? 1 - this.scoring : this.quarter % 2 ? 0 : 1, this.stage === 'goal' ? 'goal' : 'swim-off'); return;
    }
    if (this.stage === 'restart') { this.timer -= dt; if (this.timer <= 0) this.stage = 'play'; return; }
    if (this.stage !== 'play') return; this.elapsed += dt; this.possession -= dt;
    if (shotClockExpired(this.possession)) { this.turnover(1 - this.possessionTeam); return; }
    if (this.elapsed >= this.duration / 4 * this.quarter) {
      if (this.quarter === 4) { this.stage = 'over'; this.emit('fulltime', { goals: [...this.goals] }); return; }
      this.quarter++; this.stage = 'quarter'; this.timer = 2; this.message = `End of quarter ${this.quarter - 1}`; this.emit('quarter'); return;
    }
    if (input.action === 'switch') { const list = this.players.filter(p => p.team === 0 && !p.keeper).sort((a, b) => distance(a, this.ball) - distance(b, this.ball)); this.controlled = (list[0].id === this.controlled ? list[1] : list[0]).id; }
    const human = this.players[this.controlled]; if (input.action === 'steal') this.steal(human);
    if (['pass', 'lead', 'shoot'].includes(input.action)) this.throw(human, input.action, input.aim, input.power ?? .7);
    this.updatePlayers(dt, input);
    if (this.ball.owner !== null) { const p = this.players[this.ball.owner]; this.ball.x = p.x + Math.sin(p.facing) * .52; this.ball.z = p.z + Math.cos(p.facing) * .52; this.ball.y = .52 + Math.sin(this.time * 7) * .05; } else this.loose(dt);
  }
}
