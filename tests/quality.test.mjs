import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionQueue, movement, installLifecycle } from '../shared/controls.js';
import { FootballGame, STEP } from '../football/simulation.js';
import { WaterPoloGame } from '../waterpolo/simulation.js';
import { GolfGame, R } from '../golf/simulation.js';

test('one-shot inputs survive high-refresh frames and are not repeated by catch-up steps', () => {
  for (const fps of [30, 60, 120, 144]) {
    const queue = new ActionQueue(), received = [];
    let accumulator = 0;
    for (let frame = 0; frame < fps; frame++) {
      if (frame === 0) queue.push('pass');
      if (frame === 2) queue.push('shoot');
      accumulator += 1 / fps;
      while (accumulator >= STEP) { const action = queue.take(); if (action) received.push(action); accumulator -= STEP; }
    }
    assert.deepEqual(received, ['pass', 'shoot'], `${fps} Hz`);
    queue.push('pass'); queue.clear(); assert.equal(queue.take(), null);
  }
});

test('movement follows the camera and diagonal input cannot run faster', () => {
  for (const yaw of [0, .7, Math.PI / 2, Math.PI]) {
    const elements = new Array(16).fill(0); elements[8] = Math.sin(yaw); elements[10] = Math.cos(yaw);
    const camera = { matrixWorld: { elements } }, up = movement(0, -1, camera), diagonal = movement(1, 1, camera);
    assert.ok(Math.abs(up.moveX + Math.sin(yaw)) < 1e-10);
    assert.ok(Math.abs(up.moveZ + Math.cos(yaw)) < 1e-10);
    assert.ok(Math.abs(Math.hypot(diagonal.moveX, diagonal.moveZ) - 1) < 1e-10);
  }
});

test('shared lifecycle clears input, pauses on background, and reports context loss', () => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  globalThis.window = new EventTarget(); globalThis.document = new EventTarget();
  const canvas = new EventTarget(), dialog = new EventTarget(); let clears = 0, pauses = 0, fatals = 0, focused = 0;
  canvas.focus = () => focused++;
  try {
    installLifecycle({ canvas, dialogs: [dialog], clear: () => clears++, active: () => pauses === 0, pause: () => pauses++, fatal: () => fatals++ });
    window.dispatchEvent(new Event('blur')); document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
    dialog.dispatchEvent(new Event('close')); const lost = new Event('webglcontextlost', { cancelable: true }); canvas.dispatchEvent(lost);
    assert.equal(pauses, 1); assert.equal(clears, 4); assert.equal(focused, 1); assert.equal(fatals, 1); assert.equal(lost.defaultPrevented, true);
  } finally { globalThis.window = oldWindow; globalThis.document = oldDocument; }
});

test('football carrier can act before another tackle, and the dispossessed player cannot instantly steal back', () => {
  const game = new FootballGame(), owner = game.players[9], defender = game.players[20];
  game.gain(owner); defender.x = owner.x; defender.z = owner.z;
  assert.equal(game.tackle(defender), false);
  owner.cooldown = 0; defender.cooldown = 0; assert.equal(game.tackle(defender), true);
  assert.equal(game.ball.owner, defender.id); assert.equal(game.tackle(owner), false);
});

test('football AI creates attacks and completed passes for both teams at every difficulty', () => {
  for (const difficulty of ['casual', 'club', 'pro']) {
    const game = new FootballGame({ duration: 180, seed: 17, difficulty });
    for (let i = 0; i < 24000 && game.stage !== 'fulltime'; i++) game.step(STEP, { autoplay: true });
    assert.equal(game.stage, 'fulltime');
    assert.ok(game.stats.shots.every(n => n > 0), difficulty);
    assert.ok(game.stats.completed.every(n => n > 3), difficulty);
    assert.ok(game.players.every(p => Number.isFinite(p.x) && Number.isFinite(p.z)));
  }
});

test('water polo keeps each keeper at its own end regardless of restart team', () => {
  const game = new WaterPoloGame();
  for (const team of [0, 1]) {
    game.restart(team); assert.ok(game.players[0].z > 13); assert.ok(game.players[7].z < -13);
    assert.equal(game.players[game.ball.owner].team, team);
  }
});

test('water polo passes preserve the possession clock; opponents gaining the ball reset it', () => {
  const game = new WaterPoloGame(); game.possession = 12;
  game.throw(game.players[game.ball.owner], 'pass'); game.gain(game.players[2]);
  assert.equal(game.possession, 12);
  game.gain(game.players[10]); assert.equal(game.possession, 30);
});

test('water polo high-speed shots above the bar miss, while low shots score once', () => {
  for (const height of [.4, 2]) {
    const game = new WaterPoloGame(); game.stage = 'play'; game.lastTouch = 0;
    game.ball = { x: 0, y: height, z: -14.9, vx: 0, vy: 0, vz: -60, owner: null };
    game.loose(STEP);
    assert.deepEqual(game.goals, height === .4 ? [1, 0] : [0, 0]);
    assert.equal(game.stage, height === .4 ? 'goal' : 'restart');
  }
});

test('water polo human keeper can pass after turnover; Tab-style switching selects another player', () => {
  const game = new WaterPoloGame(); game.turnover(0);
  for (let i = 0; i < 41; i++) game.step(STEP);
  assert.equal(game.controlled, 0); game.step(STEP, { action: 'pass' });
  assert.equal(game.ball.owner, null); assert.equal(game.stats.passes[0], 1);
  const before = game.controlled; game.step(STEP, { action: 'switch' }); assert.notEqual(game.controlled, before);
});

test('water polo AI attacks, changes possession, and finishes all quarters', () => {
  const game = new WaterPoloGame({ duration: 180, seed: 17 });
  for (let i = 0; i < 20000 && game.stage !== 'over'; i++) game.step(STEP, { autoplay: true });
  assert.equal(game.stage, 'over'); assert.equal(game.quarter, 4);
  assert.ok(game.stats.shots.every(n => n > 0)); assert.ok(game.stats.passes.every(n => n > 0));
  assert.ok(game.stats.steals.every(n => n > 0)); assert.ok(game.goals.reduce((a, b) => a + b, 0) > 0);
});

test('golf preview is reused when stationary, invalidates with shot settings, and predicts the actual landing', () => {
  const game = new GolfGame({ holes: 3, wind: 'calm' }); game.club = 'iron'; game.power = .7;
  const initial = game.preview(); assert.equal(game.preview(), initial);
  game.power = .65; const changed = game.preview(); assert.notEqual(changed, initial);
  game.shoot(); for (let i = 0; i < 1500 && game.stage === 'flight'; i++) game.step(STEP);
  assert.equal(changed.result, 'rest'); assert.ok(Math.hypot(game.ball.x - changed.end.x, game.ball.z - changed.end.z) < .001);
});

test('golf scores and advances through a complete round without losing the next-hole state', () => {
  const game = new GolfGame({ holes: 3, wind: 'calm' });
  for (let hole = 0; hole < 3; hole++) {
    game.ball = { x: game.hole.cup.x, z: game.hole.cup.z + .7, y: R, vx: 0, vy: 0, vz: 0 };
    game.club = 'putter'; game.angle = Math.PI; game.power = .1;
    game.shoot(); for (let i = 0; i < 100 && game.stage === 'flight'; i++) game.step(STEP);
    assert.equal(game.stage, 'holed'); assert.equal(game.scores.length, hole + 1);
    game.next();
  }
  assert.equal(game.stage, 'over'); assert.equal(game.total, 3);
});
