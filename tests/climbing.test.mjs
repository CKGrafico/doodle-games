import test from 'node:test';
import assert from 'node:assert/strict';
import { ClimbingGame, HOLDS, STEP, moveOutcome } from '../climbing/simulation.js';

test('climbing power creates a bounded reach and clean power is less wasteful', () => {
  const short = moveOutcome(HOLDS[0], HOLDS[1], .05), long = moveOutcome(HOLDS[0], HOLDS[2], 1);
  assert.equal(short.secure, false); assert.equal(long.legal, true); assert.equal(long.secure, true);
  assert.ok(moveOutcome(HOLDS[0], HOLDS[1], short.required).precision < moveOutcome(HOLDS[0], HOLDS[1], 1).precision);
});

test('a move during the countdown is a false start and awards the rival', () => {
  const game = new ClimbingGame(); game.start(); game.step(STEP, { move: true });
  assert.equal(game.stage, 'finished'); assert.equal(game.falseStart, 0); assert.equal(game.winner, 1);
});

test('invalid reaches fall, preserve the last hold and allow recovery', () => {
  const game = new ClimbingGame({ difficulty: 'casual' }); game.start(); for (let i = 0; i < 400; i++) game.step(STEP);
  assert.equal(game.stage, 'racing'); game.select(8); assert.equal(game.move(1), false); assert.equal(game.player.falls, 1);
  for (let i = 0; i < 80; i++) game.step(STEP); assert.equal(game.player.hold, 0); assert.equal(game.player.moving, 0);
});

test('legal successive moves build flow, consume grip and reach the finish pad', () => {
  const game = new ClimbingGame({ difficulty: 'casual' }); game.start(); for (let i = 0; i < 400; i++) game.step(STEP);
  while (game.stage === 'racing' && !game.player.finished) {
    game.select(game.player.hold + 1); const outcome = moveOutcome(HOLDS[game.player.hold], HOLDS[game.target], 1, game.player.grip);
    assert.ok(game.move(outcome.required)); for (let i = 0; i < 100 && game.player.moving; i++) game.step(STEP);
  }
  assert.equal(game.winner, 0); assert.equal(game.player.hold, HOLDS.length - 1); assert.ok(game.player.bestCombo >= HOLDS.length - 2);
  assert.ok(game.player.time > 0 && Number.isFinite(game.player.time)); assert.ok(game.player.grip < 1);
});

test('seeded opponents finish real races at every difficulty with finite positions', () => {
  for (const difficulty of ['casual', 'club', 'pro']) {
    const game = new ClimbingGame({ difficulty, seed: 17 }); game.start();
    for (let i = 0; i < 20000 && game.stage !== 'finished'; i++) game.step(STEP);
    assert.equal(game.stage, 'finished', difficulty); assert.equal(game.winner, 1); assert.ok(game.climbers[1].hold === HOLDS.length - 1);
    assert.ok(game.climbers.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  }
});
