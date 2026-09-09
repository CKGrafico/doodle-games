import { clamp, damp, launchAir, stepAir, crossed } from '../shared/ride-physics.js';
export const STEP = 1 / 120;
export const BREAKS = [
  { name: 'Glass Bay', length: 370, speed: 10, tubeWidth: 1.55 },
  { name: 'Point Break', length: 430, speed: 11, tubeWidth: 1.3 },
  { name: 'Reef Run', length: 490, speed: 12, tubeWidth: 1.1 },
];

export class SurfGame {
  constructor({ course = 0 } = {}) {
    this.kind = 'surf'; this.course = clamp(Number(course) || 0, 0, 2);
    this.stage = 'ready'; this.time = 0; this.wave = 1; this.scores = [];
    this.events = []; this.eventId = 0; this.falls = 0; this.bestCombo = 0;
    this.stats = { cutbacks: 0, airs: 0, tubes: 0, spins: 0 };
    this.resetWave(); this.message = 'Make a line worth remembering.';
  }
  resetWave() {
    this.config = BREAKS[(this.course + this.wave - 1) % BREAKS.length];
    this.length = this.config.length; this.z = 0; this.x = -1.5; this.vx = 0;
    this.speed = this.config.speed; this.waveTime = 0; this.energy = .8;
    this.air = 0; this.spin = 0; this.recovery = 0; this.score = 0;
    this.combo = 0; this.comboValue = 0; this.comboTime = 0; this.chainKinds = new Set();
    this.cooldown = 0; this.lastTrick = ''; this.repeat = 0; this.turnAnchor = this.x;
    this.turnDirection = 0; this.turnCooldown = 0; this.tubeTime = 0;
    this.sections = [
      { type: 'tube', z: 60, end: 108, x: 1.5, done: false },
      { type: 'air', z: 145, end: 175, x: 4.8, done: false },
      { type: 'tube', z: 215, end: 264, x: 2.2, done: false },
      { type: 'air', z: 305, end: 335, x: 4.8, done: false },
    ];
    const scale = this.length / 370;
    this.sections.forEach(section => { section.z *= scale; section.end *= scale; });
    this.foam = this.wave === 1 ? [] : [{ x: -3.4, z: 192 }, { x: -.8, z: 290 }];
  }
  get context() { return [this.wave, this.falls, this.stage].join(':'); }
  get total() { return [...this.scores, this.score].sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0); }
  get pocket() { return this.currentSection?.type === 'tube' ? this.currentSection.x : 0; }
  get currentSection() { return this.sections.find(s => this.z >= s.z && this.z < s.end); }
  get nextFeature() { return this.sections.find(s => s.end > this.z); }
  get canAct() { return this.stage === 'riding' && !this.air && !this.recovery && this.cooldown <= 0 && this.energy >= .12; }
  get actionLabel() { return this.x > 3.6 ? 'LAUNCH' : 'PUMP'; }
  get goals() { return [this.stats.cutbacks >= 3, this.stats.tubes >= 2, this.stats.airs >= 2]; }
  get resultLabel() { return this.total + ' pts · ' + this.goals.filter(Boolean).length + '/3 challenges'; }
  emit(label, value = 0, type = 'trick') { this.message = label; this.events.push({ id: ++this.eventId, label, value, type }); }
  drainEvents() { return this.events.splice(0); }
  start() { if (this.stage === 'ready') { this.stage = 'riding'; this.emit('Carve left, then right. Build your first cutback.', 0, 'hint'); } }
  trick(name, points, kind = name) {
    this.repeat = this.lastTrick === kind ? this.repeat + 1 : 0; this.lastTrick = kind;
    this.chainKinds.add(kind); this.combo = Math.min(8, this.combo + 1);
    const variety = 1 + (this.chainKinds.size - 1) * .2;
    const value = Math.round(points * Math.max(.3, 1 - this.repeat * .2) * variety * (1 + (this.combo - 1) * .25));
    this.comboValue += value; this.comboTime = 5; this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.emit(name, value); this.energy = clamp(this.energy + .12, 0, 1);
  }
  bank() {
    if (this.comboValue) { this.score += this.comboValue; this.emit('Combo banked', this.comboValue, 'bank'); }
    this.combo = 0; this.comboValue = 0; this.comboTime = 0; this.chainKinds.clear();
  }
  action(power) {
    if (!this.canAct) return false;
    power = clamp(power, .05, 1); this.cooldown = .4; this.energy = Math.max(0, this.energy - .1 - power * .16);
    if (this.x > 3.6 && this.speed > 8) {
      const section = this.currentSection?.type === 'air';
      launchAir(this, .85 + power * .75 + (section ? .25 : 0), power);
      this.airBonus = section ? 1.5 : 1; this.vx = Math.min(0, this.vx) - .6;
      this.emit('Air! Steer to spin. Let go to straighten.', 0, 'hint');
    } else {
      const bottom = this.x < -1.8;
      this.speed = Math.min(18, this.speed + (bottom ? 3.2 : 1.2) + power * 3);
      this.emit(bottom ? 'Bottom-turn boost!' : 'Pump toward the lip', 0, 'pump');
    }
    return true;
  }
  wipeout() {
    const lost = this.comboValue; this.falls++; this.recovery = 1.2; this.energy = .7;
    this.combo = 0; this.comboValue = 0; this.comboTime = 0; this.chainKinds.clear();
    this.air = 0; this.spin = 0; this.x = -1; this.vx = 0; this.speed = 7; this.tubeTime = 0;
    this.turnDirection = 0; this.turnAnchor = this.x;
    this.emit(lost ? 'Wipeout! Lost ' + lost + ' unbanked points' : 'Wipeout. Back on the wave!', 0, 'crash');
  }
  nextWave() {
    this.bank(); this.scores.push(this.score); this.score = 0;
    if (this.wave === 3) { this.stage = 'finished'; this.emit('Heat complete', this.total, 'finish'); }
    else { this.stage = 'between'; this.emit(this.config.name + ' complete. Next wave?', this.scores.at(-1), 'wave'); }
  }
  continue() { if (this.stage === 'between') { this.wave++; this.resetWave(); this.stage = 'riding'; this.emit(this.config.name + ': a fresh line', 0, 'wave'); } }
  step(dt, input = {}) {
    if (this.stage !== 'riding') return;
    this.time += dt; this.waveTime += dt; this.cooldown = Math.max(0, this.cooldown - dt);
    this.turnCooldown = Math.max(0, this.turnCooldown - dt); this.energy = clamp(this.energy + dt * .055, 0, 1);
    const steer = clamp(input.steer || 0, -1, 1), brake = !!input.brake;
    const oldZ = this.z, oldX = this.x;
    if (this.recovery) this.recovery = Math.max(0, this.recovery - dt);
    else {
      const inAir = this.air > 0;
      this.vx = damp(this.vx, inAir ? -.5 : steer * (brake ? 5.2 : 6.8), inAir ? 2 : 10, dt);
      this.x += this.vx * dt;
      this.speed = damp(this.speed, this.config.speed + (this.x < 0 ? 2 : -1) - (brake && !inAir ? 4 : 0), .38, dt);
      if (inAir) {
        const landing = stepAir(this, dt, steer, brake);
        if (landing) {
          if (!landing.clean) this.wipeout();
          else { this.stats.airs++; this.stats.spins += landing.turns; this.trick(landing.name, (160 + landing.turns * 200 + (landing.grabbed ? 90 : 0)) * this.airBonus, landing.turns ? 'spin' : 'air'); this.spin = 0; }
        }
      } else {
        const direction = Math.abs(steer) > .25 ? Math.sign(steer) : 0;
        if (direction && direction !== this.turnDirection) {
          if (this.turnDirection && Math.abs(this.x - this.turnAnchor) > 3 && this.turnCooldown <= 0 && this.speed > 7) {
            this.stats.cutbacks++; this.trick(brake ? 'Snap turn' : 'Cutback', brake ? 130 : 100, brake ? 'snap' : 'cutback'); this.turnCooldown = .8;
          }
          this.turnAnchor = this.x; this.turnDirection = direction;
        }
        const tube = this.currentSection;
        if (tube?.type === 'tube' && Math.abs(this.x - tube.x) < this.config.tubeWidth && Math.abs(this.vx) < 2.5) {
          this.tubeTime += dt;
          if (this.tubeTime >= 1.25 && !tube.done) { tube.done = true; this.stats.tubes++; this.trick('Barrel ride', 320, 'tube'); }
        } else this.tubeTime = 0;
      }
      if (this.x > 6 || this.x < -6) this.wipeout();
    }
    this.z += this.speed * dt;
    if (!this.air && !this.recovery) for (const foam of this.foam) {
      if (crossed(oldZ, this.z, foam, oldX, this.x, 1)) { this.speed = Math.max(5, this.speed - 4); this.emit('Whitewater! Pump back into the face.', 0, 'hazard'); }
    }
    if (this.comboTime > 0 && !this.air) { this.comboTime = Math.max(0, this.comboTime - dt); if (!this.comboTime) this.bank(); }
    if (this.z >= this.length || this.waveTime >= 50) this.nextWave();
  }
}
