import { clamp, damp, launchAir, stepAir, crossed } from '../shared/ride-physics.js';
export const STEP = 1 / 120;
export const COURSES = [
  { name: 'Pine Sprint', length: 780, pace: 21, width: 2.4, turns: 4.2 },
  { name: 'Glacier Cross', length: 1080, pace: 23, width: 2.1, turns: 5.2 },
  { name: 'Ridge Rush', length: 1380, pace: 25, width: 1.9, turns: 6 },
];

function rider(name, x = 0) {
  return { name, x, vx: 0, z: 0, speed: 9, air: 0, spin: 0, recovery: 0, energy: .65,
    boost: 0, cooldown: 0, popWindow: 0, popPower: 0, falls: 0, nextGate: 0,
    passed: 0, missed: 0, streak: 0, bestStreak: 0, style: 0, jumps: 0,
    finishTime: null, used: new Set(), nearMisses: new Set() };
}

export class SkiGame {
  constructor({ course = 0 } = {}) {
    Object.assign(this, rider('You'));
    this.kind = 'ski'; this.course = clamp(Number(course) || 0, 0, 2);
    this.config = COURSES[this.course]; this.length = this.config.length;
    this.stage = 'ready'; this.time = 0; this.events = []; this.eventId = 0;
    this.message = 'Four racers. One finish line. Choose your line.';
    this.rivals = [rider('Ruby', -1.8), rider('Graphite', 1.8), rider('Indigo', 3.2)];
    this.gates = Array.from({ length: Math.floor((this.length - 75) / 48) }, (_, i) =>
      ({ z: 45 + i * 48, x: Math.sin(i * .92) * this.config.turns }));
    this.features = [];
    for (let z = 115, i = 0; z < this.length - 60; z += 170, i++) {
      const sign = i % 2 ? -1 : 1;
      this.features.push({ id: 'ramp' + i, type: 'ramp', x: sign * 5.8, z, width: 1.9 });
      this.features.push({ id: 'boost' + i, type: 'boost', x: -sign * 4.3, z: z + 30, width: 1.5 });
    }
    this.rocks = Array.from({ length: Math.floor(this.length / 125) }, (_, i) =>
      ({ id: 'rock' + i, x: (i % 2 ? -1 : 1) * (6.8 - (i % 3) * .55), z: 175 + i * 117 }));
  }
  get context() { return [this.stage, this.falls].join(':'); }
  get total() { return this.finishTime ?? this.time; }
  get rank() {
    return 1 + this.rivals.filter(r => this.finishTime !== null
      ? r.finishTime !== null && r.finishTime <= this.finishTime : r.z > this.z).length;
  }
  get nextFeature() { return this.features.find(f => f.z > this.z); }
  get nearRamp() { return this.features.find(f => f.type === 'ramp' && f.z >= this.z && f.z - this.z < 18 && Math.abs(f.x - this.x) < 2.8); }
  get canAct() { return this.stage === 'riding' && !this.air && !this.recovery && this.cooldown <= 0 && this.energy >= .2; }
  get actionLabel() { return this.nearRamp ? 'LOAD JUMP' : 'BOOST'; }
  get goals() { return [this.rank === 1, this.bestStreak >= 5, this.jumps >= 2]; }
  get resultLabel() { return '#' + this.rank + ' / 4 · ' + this.total.toFixed(2) + ' s · ' + this.passed + '/' + this.gates.length + ' gates'; }
  emit(label, value = 0, type = 'trick') { this.message = label; this.events.push({ id: ++this.eventId, label, value, type }); }
  drainEvents() { return this.events.splice(0); }
  start() { if (this.stage === 'ready') { this.stage = 'riding'; this.emit('Go! Clean gates refill your boost.', 0, 'start'); } }
  action(power) {
    if (!this.canAct) return false;
    power = clamp(power, .05, 1); this.energy = Math.max(0, this.energy - .16 - power * .22); this.cooldown = .4;
    if (this.nearRamp) { this.popWindow = 2; this.popPower = power; this.emit('Jump loaded. Aim for the ramp!', 0, 'pump'); }
    else { this.boost = 1 + power * 1.4; this.speed = Math.min(34, this.speed + 2 + power * 3); this.emit('Boost!', 0, 'pump'); }
    return true;
  }
  crash(r = this) {
    if (r.recovery) return;
    r.falls++; r.recovery = .95; r.speed = 6; r.vx = 0; r.x = clamp(r.x, -7.5, 7.5);
    r.air = 0; r.spin = 0; r.boost = 0; r.streak = 0;
    if (r === this) this.emit('Fall! Recover and chase them down.', 0, 'crash');
  }
  updateRider(r, dt, input, pace = this.config.pace) {
    if (r.finishTime !== null) return;
    r.energy = clamp(r.energy + dt * .04, 0, 1);
    r.cooldown = Math.max(0, r.cooldown - dt); r.popWindow = Math.max(0, r.popWindow - dt); r.boost = Math.max(0, r.boost - dt);
    if (r.recovery) { r.recovery = Math.max(0, r.recovery - dt); return; }
    const oldZ = r.z, oldX = r.x, steer = clamp(input.steer || 0, -1, 1), brake = !!input.brake, airborne = r.air > 0;
    r.speed = damp(r.speed, (r.boost ? pace + 10 : pace) - Math.abs(steer) * 2.5 - (brake && !airborne ? 13 : 0), brake ? 2.6 : .7, dt);
    r.vx = damp(r.vx, airborne ? r.vx * .995 : steer * (brake ? 11 : 9), airborne ? 1 : 10, dt);
    r.x += r.vx * dt; r.z += r.speed * dt;
    if (airborne) {
      const landing = stepAir(r, dt, steer, brake);
      if (landing) {
        if (!landing.clean) this.crash(r);
        else {
          r.jumps++; r.style += 100 + landing.turns * 150 + (landing.grabbed ? 60 : 0);
          r.energy = clamp(r.energy + .18 + landing.turns * .1, 0, 1); r.boost = 1 + landing.turns * .4; r.spin = 0;
          if (r === this) this.emit(landing.name + ' landed. Speed bonus!', 0, 'trick');
        }
      }
    }
    for (const feature of this.features) {
      if (r.used.has(feature.id) || !crossed(oldZ, r.z, feature, oldX, r.x, feature.width)) continue;
      r.used.add(feature.id);
      if (feature.type === 'ramp' && !r.air && !r.recovery) {
        const power = r.popWindow ? r.popPower : .3;
        launchAir(r, 1.05 + power * .95, power); r.vx *= .35; r.popWindow = 0;
        if (r === this) this.emit('Air! Spin, grab, then straighten.', 0, 'hint');
      } else if (feature.type === 'boost') {
        r.energy = clamp(r.energy + .3, 0, 1); r.boost = 1.3;
        if (r === this) this.emit('Boost line collected', 0, 'pump');
      }
    }
    for (const rock of this.rocks) {
      if (oldZ >= rock.z || r.z < rock.z || r.air || r.recovery) continue;
      if (crossed(oldZ, r.z, rock, oldX, r.x, .95)) this.crash(r);
      else if (!r.nearMisses.has(rock.id) && crossed(oldZ, r.z, rock, oldX, r.x, 1.8)) {
        r.nearMisses.add(rock.id); r.energy = clamp(r.energy + .13, 0, 1);
        if (r === this) this.emit('Close shave! Boost earned', 0, 'trick');
      }
    }
    while (r.nextGate < this.gates.length && r.z >= this.gates[r.nextGate].z) {
      const gate = this.gates[r.nextGate++];
      if (crossed(oldZ, r.z, gate, oldX, r.x, this.config.width)) {
        r.passed++; r.streak++; r.bestStreak = Math.max(r.bestStreak, r.streak); r.energy = clamp(r.energy + .11, 0, 1);
        if (r.streak % 3 === 0) r.boost = .8;
        if (r === this) this.emit(r.streak > 1 ? 'Clean line ×' + r.streak : 'Gate cleared', 0, 'gate');
      } else {
        r.missed++; r.streak = 0; r.speed = Math.max(7, r.speed - 3);
        if (r === this) this.emit('Missed gate. Find the next flags.', 0, 'miss');
      }
    }
    if (Math.abs(r.x) > 8.8) this.crash(r);
    if (r.z >= this.length) {
      r.finishTime = this.time - dt + dt * clamp((this.length - oldZ) / (r.z - oldZ), 0, 1);
      r.z = this.length;
    }
  }
  step(dt, input = {}) {
    if (this.stage !== 'riding') return;
    this.time += dt; this.updateRider(this, dt, input);
    this.rivals.forEach((r, i) => {
      const gate = this.gates[r.nextGate];
      let target = gate?.x ?? 0;
      const feature = this.features.find(f => f.z > r.z && f.z - r.z < 32);
      if (feature && (!gate || gate.z - r.z > 35) && (i === 0 || feature.type === 'boost')) target = feature.x;
      if (!r.air && r.energy > .65 && Math.abs(target - r.x) < 1.5) {
        r.boost = 2; r.speed = Math.min(34, r.speed + 4.4); r.energy -= .4;
      }
      const steer = r.air ? 0 : clamp((target - r.x) * .58 - r.vx * .1, -.9, .9);
      this.updateRider(r, dt, { steer, brake: !r.air && Math.abs(target - r.x) > 4 && (gate?.z - r.z) < 20 }, this.config.pace - 1.2 + i * .3);
    });
    if (this.finishTime !== null) { this.stage = 'finished'; this.emit(this.rank === 1 ? 'First over the line!' : 'Finished #' + this.rank + '. Race again?', 0, 'finish'); }
  }
}
