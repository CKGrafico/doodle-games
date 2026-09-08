export const STEP = 1 / 120;
export const LANE = { halfWidth: 2, halfLength: 7.5, circleZ: 6.3 };
export const MODES = { point: { label: 'Arrimar', angle: 28 }, lob: { label: 'Lanzar alto', angle: 58 }, shoot: { label: 'Tirar', angle: 10 } };
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function randomSource(seed = 21) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n; return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
const body = (id, team, x, z, jack = false) => ({ id, team, x, z, y: jack ? .065 : .12, r: jack ? .065 : .12, mass: jack ? .09 : 1, vx: 0, vy: 0, vz: 0, dead: false, jack });
export function ranking(balls, jack) {
  return balls.filter(b => !b.dead).map(b => ({ id: b.id, team: b.team, distance: distance(b, jack) })).sort((a, b) => a.distance - b.distance);
}
export function scoreEnd(balls, jack) {
  const rank = ranking(balls, jack);
  if (!rank.length) return { team: null, points: 0 };
  const first = rank[0], enemy = rank.find(b => b.team !== first.team);
  if (enemy && Math.abs(first.distance - enemy.distance) < .001) return { team: null, points: 0 };
  return { team: first.team, points: rank.filter(b => b.team === first.team && (!enemy || b.distance < enemy.distance - .001)).length };
}
export function nextTeam(balls, jack, remaining, lastTeam) {
  if (!remaining[0] && !remaining[1]) return null;
  if (!remaining[0]) return 1;
  if (!remaining[1]) return 0;
  const lead = scoreEnd(balls, jack).team;
  return lead === null ? 1 - lastTeam : 1 - lead;
}
function integrate(b, dt) {
  if (b.dead) return;
  if (b.y > b.r + .0001 || b.vy > 0) {
    b.vy -= 9.81 * dt;
  } else {
    const speed = Math.hypot(b.vx, b.vz), next = Math.max(0, speed - (b.jack ? .8 : 1.7) * dt);
    if (speed) { b.vx *= next / speed; b.vz *= next / speed; }
    b.vy = 0;
  }
  b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
  if (b.y < b.r) {
    b.y = b.r;
    if (Math.abs(b.vy) > .8) { b.vy = -b.vy * .18; b.vx *= .72; b.vz *= .72; }
    else b.vy = 0;
  }
}
export function collide(a, b) {
  if (a.dead || b.dead) return false;
  let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz), radius = a.r + b.r;
  if (len >= radius) return false;
  if (len < .000001) { dx = 1; dy = dz = 0; len = 1; }
  const nx = dx / len, ny = dy / len, nz = dz / len, ia = 1 / a.mass, ib = 1 / b.mass, inv = ia + ib;
  const overlap = Math.max(0, radius - len) + .00001;
  a.x -= nx * overlap * ia / inv; a.y -= ny * overlap * ia / inv; a.z -= nz * overlap * ia / inv;
  b.x += nx * overlap * ib / inv; b.y += ny * overlap * ib / inv; b.z += nz * overlap * ib / inv;
  const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
  if (relative < 0) {
    const impulse = -(1 + .68) * relative / inv;
    a.vx -= impulse * nx * ia; a.vy -= impulse * ny * ia; a.vz -= impulse * nz * ia;
    b.vx += impulse * nx * ib; b.vy += impulse * ny * ib; b.vz += impulse * nz * ib;
  }
  a.y = Math.max(a.r, a.y); b.y = Math.max(b.r, b.y);
  return relative < -.2;
}
function launch(speed, angle, heading) {
  const b = body(-1, 0, 0, LANE.circleZ), elevation = angle * Math.PI / 180;
  b.y = .7; b.vx = Math.sin(heading) * Math.cos(elevation) * speed;
  b.vz = -Math.cos(heading) * Math.cos(elevation) * speed; b.vy = Math.sin(elevation) * speed;
  return b;
}
export function trajectory(reach, mode = 'point', heading = 0) {
  const angle = MODES[mode].angle;
  // Calibrate nominal travel on an empty lane. Collisions can change the result.
  let lo = .1, hi = 18;
  for (let n = 0; n < 18; n++) {
    const mid = (lo + hi) / 2, b = launch(mid, angle, 0);
    for (let i = 0; i < 1800; i++) { integrate(b, STEP); if (b.y <= b.r && Math.hypot(b.vx, b.vy, b.vz) < .015) break; }
    if (LANE.circleZ - b.z < reach) lo = mid; else hi = mid;
  }
  const initial = launch((lo + hi) / 2, angle, heading), b = { ...initial }, path = [{ ...b }];
  for (let i = 0; i < 1800; i++) { integrate(b, STEP); if (i % 8 === 0) path.push({ ...b }); if (b.y <= b.r && Math.hypot(b.vx, b.vy, b.vz) < .015) break; }
  path.push({ ...b }); return { initial, path, end: { ...b } };
}
export class PetancaGame {
  constructor({ difficulty = 'club', seed = 21 } = {}) {
    this.difficulty = difficulty; this.random = randomSource(seed); this.scores = [0, 0]; this.endNumber = 0; this.starter = 0;
    this.events = []; this.mode = 'point'; this.heading = 0; this.reach = 8; this.nextEnd();
  }
  nextEnd() {
    if (this.scores.some(s => s >= 13)) return;
    this.endNumber++; this.remaining = [3, 3]; this.balls = []; this.jack = body('jack', null, 0, -1.7, true);
    this.turn = this.starter; this.mode = 'point'; this.heading = 0; this.reach = 8; this.result = null; this.timer = 0;
    this.stage = this.starter === 0 ? 'jack' : 'thinking';
    if (this.starter === 1) { this.jack.x = (this.random() - .5) * 1.6; this.jack.z = LANE.circleZ - (6.6 + this.random() * 2.6); this.timer = 1.2; }
    this.events.push({ type: 'end' });
  }
  placeJack() {
    if (this.stage !== 'jack') return false;
    const reach = clamp(this.reach, 6, 10), x = Math.sin(this.heading) * reach, z = LANE.circleZ - Math.cos(this.heading) * reach;
    if (Math.abs(x) > 1.45) return false;
    this.jack.x = x; this.jack.z = z; this.stage = 'aim'; this.aimJack(); this.events.push({ type: 'jack' }); return true;
  }
  aimAt(point) { this.heading = clamp(Math.atan2(point.x, LANE.circleZ - point.z), -.42, .42); this.reach = clamp(distance({ x: 0, z: LANE.circleZ }, point), this.stage === 'jack' ? 6 : 2, this.stage === 'jack' ? 10 : 13); }
  aimJack() { this.aimAt(this.jack); }
  shoot() {
    if (this.stage !== 'aim' || !this.remaining[this.turn]) return false;
    const b = trajectory(this.reach, this.mode, this.heading).initial;
    b.id = this.balls.length; b.team = this.turn; this.balls.push(b); this.remaining[this.turn]--;
    this.stage = 'rolling'; this.timer = 0; this.settled = 0; this.events.push({ type: 'throw' }); return true;
  }
  ai() {
    const error = { casual: .65, club: .3, pro: .13 }[this.difficulty] ?? .3;
    const rank = ranking(this.balls, this.jack), attack = rank.length && rank[0].team === 0 && rank[0].distance < .65 && this.random() < .45;
    const target = attack ? this.balls.find(b => b.id === rank[0].id) : this.jack;
    this.mode = attack ? 'shoot' : this.random() < .35 ? 'lob' : 'point';
    this.aimAt({ x: target.x + (this.random() - .5) * error * 2, z: target.z + (this.random() - .5) * error * 2 });
    this.stage = 'aim'; this.shoot();
  }
  finish(result) {
    this.result = result;
    if (result.team !== null) { this.scores[result.team] += result.points; this.starter = result.team; }
    this.stage = this.scores.some(s => s >= 13) ? 'over' : 'end';
    this.events.push({ type: 'score', ...result });
  }
  settle() {
    if (this.jack.dead) {
      const team = this.remaining[0] > 0 && !this.remaining[1] ? 0 : this.remaining[1] > 0 && !this.remaining[0] ? 1 : null;
      this.finish({ team, points: team === null ? 0 : this.remaining[team], deadJack: true }); return;
    }
    const next = nextTeam(this.balls, this.jack, this.remaining, this.turn);
    if (next === null) { this.finish(scoreEnd(this.balls, this.jack)); return; }
    this.turn = next; this.stage = next === 0 ? 'aim' : 'thinking'; this.timer = 1.3; this.aimJack();
  }
  step(dt) {
    if (this.stage === 'thinking') { this.timer -= dt; if (this.timer <= 0) this.ai(); return; }
    if (this.stage !== 'rolling') return;
    const bodies = [...this.balls, this.jack]; this.timer += dt;
    for (const b of bodies) integrate(b, dt);
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) if (collide(bodies[i], bodies[j])) this.events.push({ type: 'hit' });
    for (const b of bodies) if (!b.dead && (Math.abs(b.x) > LANE.halfWidth + b.r || Math.abs(b.z) > LANE.halfLength + b.r)) { b.dead = true; b.vx = b.vy = b.vz = 0; this.events.push({ type: 'out' }); }
    const moving = bodies.some(b => !b.dead && (b.y > b.r + .001 || Math.hypot(b.vx, b.vy, b.vz) > .015));
    this.settled = moving ? 0 : this.settled + dt;
    if (this.settled > .35 || this.timer > 18) { for (const b of bodies) { b.vx = b.vy = b.vz = 0; b.y = b.r; } this.settle(); }
  }
  drainEvents() { return this.events.splice(0); }
}
