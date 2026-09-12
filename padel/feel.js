import { clamp } from './rules.js';

// Metres and seconds. A short run-up gives weight without delaying first input.
export const MOTION = Object.freeze({ acceleration: 78, braking: 94, reversal: 110 });

export function moveAthlete(player, target, speed, dt) {
  const dx = target.x - player.x, dz = target.z - player.z;
  const distance = Math.hypot(dx, dz);
  const pace = distance > .015 ? Math.min(speed, Math.sqrt(2 * MOTION.braking * distance)) : 0;
  const vx = distance ? dx / distance * pace : 0;
  const vz = distance ? dz / distance * pace : 0;
  const changeX = vx - player.vx, changeZ = vz - player.vz;
  const change = Math.hypot(changeX, changeZ);
  const reversing = vx * player.vx + vz * player.vz < 0;
  const slowing = pace < Math.hypot(player.vx, player.vz);
  const rate = reversing ? MOTION.reversal : slowing ? MOTION.braking : MOTION.acceleration;
  const blend = change ? Math.min(1, rate * dt / change) : 1;
  const nextX = player.vx + changeX * blend, nextZ = player.vz + changeZ * blend;
  const stepX = (player.vx + nextX) * .5 * dt, stepZ = (player.vz + nextZ) * .5 * dt;
  const oldX = player.x, oldZ = player.z;
  player.x += stepX; player.z += stepZ;
  player.vx = nextX; player.vz = nextZ;
  // Arrive at an AI target, without circling or overshooting it on alternate ticks.
  if (speed > 0 && distance < .2 && stepX * dx + stepZ * dz >= distance * distance) {
    player.x = target.x; player.z = target.z; player.vx = 0; player.vz = 0;
  }
  const x = clamp(player.x, -4.58, 4.58);
  const z = player.team === 0 ? clamp(player.z, .6, 9.55) : clamp(player.z, -9.55, -.6);
  // Keep the tangent velocity when meeting a wall.
  if (x !== player.x) player.vx = 0;
  if (z !== player.z) player.vz = 0;
  player.x = x; player.z = z;
  player.stride = (player.stride ?? 0) + Math.hypot(x - oldX, z - oldZ) * Math.PI / .7;
}

const poseFields = ['x', 'z', 'vx', 'vz', 'stride', 'preparation'];
function copyPose(target, source) {
  for (const field of poseFields) target[field] = source[field] ?? 0;
}

// Reused snapshots keep rendering smooth between 120 Hz simulation ticks.
// Discontinuities deliberately snap: never draw a ball flying through a reset.
export class PadelPresentation {
  constructor(game) {
    this.previous = { players: game.players.map(() => ({})), ball: {} };
    this.state = { players: game.players.map(() => ({})), ball: {} };
    this.capture(game);
  }
  capture(game) {
    this.game = game; this.revision = game.poseVersion; this.hit = game.lastHitTime;
    for (let i = 0; i < game.players.length; i++) copyPose(this.previous.players[i], game.players[i]);
    Object.assign(this.previous.ball, game.ball);
  }
  sample(game, alpha = 1) {
    if (game !== this.game || game.poseVersion !== this.revision || game.lastHitTime !== this.hit) this.capture(game);
    alpha = clamp(alpha, 0, 1);
    for (let i = 0; i < game.players.length; i++) {
      const current = game.players[i], previous = this.previous.players[i], out = this.state.players[i];
      Object.assign(out, current);
      for (const field of poseFields) out[field] = previous[field] + ((current[field] ?? 0) - previous[field]) * alpha;
    }
    Object.assign(this.state.ball, game.ball);
    for (const field of ['x', 'y', 'z']) this.state.ball[field] = this.previous.ball[field] + (game.ball[field] - this.previous.ball[field]) * alpha;
    Object.assign(this.state, { controlled: game.controlled, aim: game.aim, stage: game.stage, poseVersion: game.poseVersion });
    return this.state;
  }
}

export class PadelClock {
  constructor(step = 1 / 120) { this.step = step; this.accumulator = 0; }
  reset() { this.accumulator = 0; }
  advance(dt, game, readInput, presentation) {
    const elapsed = this.accumulator + Math.max(0, dt);
    const dropped = Math.max(0, elapsed - this.step * 8);
    this.accumulator = Math.min(elapsed, this.step * 8);
    let steps = 0;
    while (this.accumulator + 1e-12 >= this.step) {
      presentation.capture(game);
      game.step(this.step, readInput());
      this.accumulator = Math.max(0, this.accumulator - this.step); steps++;
    }
    return { alpha: this.accumulator / this.step, steps, dropped };
  }
}

export function strokePose(player) {
  const stroke = player.stroke;
  if (!stroke || player.swing <= 0) {
    const ready = player.preparation ?? 0;
    return { armX: -.2 - ready * .65, armZ: -.1 - ready * .35, twist: -.18 * ready, locked: false };
  }
  const remaining = clamp(player.swing / stroke.duration, 0, 1);
  // Contact is the first pose after the physical strike, then follow-through
  // and recovery. Preparation happens while waiting/charging before contact.
  const follow = Math.sin((1 - remaining) * Math.PI) * .35;
  const backhand = stroke.hand === 'backhand' ? -1 : 1;
  const overhead = stroke.kind === 'smash';
  const lift = overhead ? 2.65 : stroke.kind === 'lob' ? 1.85 : stroke.kind === 'volley' ? 1.05 : 1.45;
  return {
    armX: -.2 - lift * remaining - follow,
    armZ: -.1 - backhand * (.65 * remaining + follow),
    twist: backhand * (.3 * remaining + follow),
    locked: remaining > .3,
  };
}
