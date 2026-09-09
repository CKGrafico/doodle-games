import { clamp, damp, launchAir, stepAir, crossed } from '../shared/ride-physics.js';
export const STEP = 1 / 120;
export const BREAKS = [
  { name: 'Glass Bay', length: 370, speed: 10, tubeWidth: 1.55 },
  { name: 'Point Break', length: 430, speed: 11, tubeWidth: 1.3 },
  { name: 'Reef Run', length: 490, speed: 12, tubeWidth: 1.1 },
];

export class SurfGame {
  constructor({ course = 0, practice = false } = {}) {
    this.kind = 'surf'; this.course = clamp(Number(course) || 0, 0, 2);
    this.stage = 'ready'; this.time = 0; this.wave = 1; this.scores = []; this.practice = practice;
    this.events = []; this.eventId = 0; this.falls = 0; this.bestCombo = 0;
    this.stats = { cutbacks: 0, airs: 0, tubes: 0, spins: 0 };
    this.resetWave(); this.message = 'Make a line worth remembering.';
  }
  resetWave() {
    this.config = BREAKS[(this.course + this.wave - 1) % BREAKS.length];
    this.length = this.config.length; this.z = 0; this.x = -1.5; this.vx = 0;
    this.speed = this.config.speed; this.waveTime = 0; this.energy = .8;
    this.heading = 0; this.special = 0; this.specialTime = 0; this.shoulder = 14;
    this.balance = 0; this.tubePoints = 0; this.inTube = false; this.activeTube = null;
    this.bottomLoaded = false;
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
  get actionLabel() { return this.x > 3.6 ? 'RELEASE AIR' : 'BOTTOM TURN'; }
  get goals() { return [this.stats.cutbacks >= 3, this.stats.tubes >= 2, this.stats.airs >= 2]; }
  get resultLabel() { return this.total + ' pts · ' + this.goals.filter(Boolean).length + '/3 challenges'; }
  emit(label, value = 0, type = 'trick') { this.message = label; this.events.push({ id: ++this.eventId, label, value, type }); }
  drainEvents() { return this.events.splice(0); }
  start() { if (this.stage === 'ready') { this.stage = 'riding'; this.emit('Drop down the face. Turn up into the lip.', 0, 'hint'); } }
  trick(name, points, kind = name) {
    this.repeat = this.lastTrick === kind ? this.repeat + 1 : 0; this.lastTrick = kind;
    this.chainKinds.add(kind); this.combo = Math.min(8, this.combo + 1);
    const variety = 1 + (this.chainKinds.size - 1) * .2;
    const value = Math.round(points * Math.max(.3, 1 - this.repeat * .2) * variety * (1 + (this.combo - 1) * .25) * (this.specialTime ? 2 : 1));
    this.comboValue += value; this.comboTime = 5; this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.emit(name, value); this.energy = clamp(this.energy + .12, 0, 1);
    this.special = clamp(this.special + .16 * Math.max(.3, 1 - this.repeat * .2), 0, 1);
  }
  activateSpecial() {
    if (this.stage !== 'riding' || this.recovery || this.special < 1 || this.specialTime) return false;
    this.special = 0; this.specialTime = 8; this.emit('SPECIAL! Double points · bigger airs', 0, 'bank'); return true;
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
      launchAir(this, .85 + power * .75 + (section ? .25 : 0) + (this.specialTime ? .35 : 0), power);
      this.airBonus = section ? 1.5 : 1; this.vx = Math.min(0, this.vx) - .6;
      this.emit('Air! Steer to spin. Let go to straighten.', 0, 'hint');
    } else {
      const bottom = this.x < -1.8; this.bottomLoaded = bottom;
      this.speed = Math.min(18, this.speed + (bottom ? 3.2 : 1.2) + power * 3);
      this.emit(bottom ? 'Bottom-turn boost!' : 'Pump toward the lip', 0, 'pump');
    }
    return true;
  }
  wipeout() {
    const lost = this.comboValue; this.falls++; this.recovery = 1.2; this.energy = .7;
    this.combo = 0; this.comboValue = 0; this.comboTime = 0; this.chainKinds.clear();
    this.air = 0; this.spin = 0; this.x = -1; this.vx = 0; this.speed = 7; this.tubeTime = 0;
    this.heading = 0; this.shoulder = 14; this.balance = 0; this.inTube = false; this.tubePoints = 0; this.special = 0; this.specialTime = 0;
    this.bottomLoaded = false; this.activeTube = null;
    this.turnDirection = 0; this.turnAnchor = this.x;
    this.emit(lost ? 'Wipeout! Lost ' + lost + ' unbanked points' : 'Wipeout. Back on the wave!', 0, 'crash');
  }
  nextWave() {
    this.bank(); this.scores.push(this.score); this.score = 0;
    if (this.practice) { this.wave++; this.resetWave(); this.stage = 'riding'; this.emit('Free surf · another wave', 0, 'wave'); }
    else if (this.wave === 3) { this.stage = 'finished'; this.emit('Heat complete', this.total, 'finish'); }
    else { this.stage = 'between'; this.emit(this.config.name + ' complete. Next wave?', this.scores.at(-1), 'wave'); }
  }
  continue() { if (this.stage === 'between') { this.wave++; this.resetWave(); this.stage = 'riding'; this.emit(this.config.name + ': a fresh line', 0, 'wave'); } }
  step(dt, input = {}) {
    if (this.stage !== 'riding') return;
    this.time += dt; this.waveTime += dt; this.cooldown = Math.max(0, this.cooldown - dt);
    this.turnCooldown = Math.max(0, this.turnCooldown - dt); this.energy = clamp(this.energy + dt * .055, 0, 1);
    this.specialTime = Math.max(0, this.specialTime - dt);
    const steer = clamp(input.steer || 0, -1, 1), brake = !!input.brake;
    const oldZ = this.z, oldX = this.x;
    if (this.recovery) this.recovery = Math.max(0, this.recovery - dt);
    else {
      const inAir = this.air > 0;
      // Board heading and momentum create arcs. Neutral trims back down the line.
      // Mouse supplies a desired heading; keyboard and stick bank the board.
      const targetHeading = input.trim ? 0 : input.heading === undefined ? steer * 1.15 : clamp(input.heading, -1.15, 1.15);
      this.heading = damp(this.heading, inAir ? 0 : targetHeading, brake ? 4.5 : 2.4, dt);
      this.vx = damp(this.vx, inAir ? -1.5 : Math.sin(this.heading) * this.speed * .65, inAir ? 2 : 7, dt);
      this.x += this.vx * dt;
      // Descending builds speed; climbing spends it. Hard carving trades speed for turn rate.
      this.speed = clamp(this.speed + (-this.vx * .65 - Math.abs(this.heading) * (brake ? .9 : .25)) * dt, 5, 21);
      this.speed = damp(this.speed, this.config.speed + 1, .16, dt);
      this.shoulder = clamp(this.shoulder + (this.speed * Math.cos(this.heading) - this.config.speed * .83) * dt, -8, 28);
      if (this.shoulder <= -8) { this.wipeout(); this.emit('Caught by the curl! Trim down the line to escape.', 0, 'crash'); }
      if (inAir) {
        const landing = stepAir(this, dt, steer, brake);
        if (landing) {
          if (!landing.clean) this.wipeout();
          else { this.stats.airs++; this.stats.spins += landing.turns; this.trick((this.specialTime ? 'Special ' : '') + landing.name, (160 + landing.turns * 200 + (landing.grabbed ? 90 : 0)) * this.airBonus, landing.turns ? 'spin' : 'air'); this.spin = 0; this.heading = -.45; this.speed = Math.min(21, this.speed + 2); }
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
        const inside = tube?.type === 'tube' && !tube.done && Math.abs(this.x - tube.x) < this.config.tubeWidth;
        if (inside) {
          this.inTube = true; this.activeTube = tube;
          this.tubeTime += dt;
          this.balance += (Math.sin(this.waveTime * 2.3) * .32 + .2 + steer * 1.5) * dt;
          this.balance = clamp(this.balance, -1.2, 1.2);
          this.tubePoints += dt * 150;
          if (Math.abs(this.balance) > 1) { this.wipeout(); this.emit('Tube closed out! Balance gently, then exit.', 0, 'crash'); }
        } else if (this.inTube) {
          if (this.tubeTime >= 1.25) {
            if (this.activeTube) this.activeTube.done = true;
            this.stats.tubes++; this.trick('Barrel exit · ' + this.tubeTime.toFixed(1) + 's', Math.round(180 + this.tubePoints), 'tube');
          }
          this.inTube = false; this.activeTube = null; this.balance = 0; this.tubeTime = 0; this.tubePoints = 0;
        }
        if (this.bottomLoaded && this.x > 3.1 && this.vx > 1 && this.speed > 8) {
          this.trick('Bottom-to-top carve', 180, 'bottom-turn'); this.bottomLoaded = false;
        }
        // A committed lip hit has its own move even without a charged launch.
        if (this.x > 4.5 && this.vx > 1 && brake && this.turnCooldown <= 0) {
          this.trick('Off the lip', 190, 'lip'); this.heading = -.8; this.vx = -3; this.turnCooldown = 1.2;
        }
      }
      if (this.x > 6 || this.x < -6) this.wipeout();
    }
    this.z += this.speed * Math.max(.35, Math.cos(this.heading)) * dt;
    if (!this.air && !this.recovery) for (const foam of this.foam) {
      if (crossed(oldZ, this.z, foam, oldX, this.x, 1)) { this.speed = Math.max(5, this.speed - 4); this.emit('Whitewater! Pump back into the face.', 0, 'hazard'); }
    }
    if (this.comboTime > 0 && !this.air && !this.inTube) { this.comboTime = Math.max(0, this.comboTime - dt); if (!this.comboTime) this.bank(); }
    if (this.z >= this.length || this.waveTime >= 50) this.nextWave();
  }
}
