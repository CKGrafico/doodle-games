import test from 'node:test';
import assert from 'node:assert/strict';
import { COURT, Score, Rally, legalServe, inKitchen } from '../pickleball/rules.js';
import { PickleballGame, STEP } from '../pickleball/simulation.js';
import { FootballGame } from '../football/simulation.js';
import { wantsSprint } from '../shared/controls.js';

const player = (id, z = id < 2 ? 3 : -3) => ({ id, team: Math.floor(id / 2), x: 0, z });

test('pickleball serves are diagonal, beyond the kitchen, and include baseline/side/centre lines', () => {
  assert.equal(legalServe(-1, -5, 0, 1), true);
  assert.equal(legalServe(1, -5, 0, 1), false);
  assert.equal(legalServe(-1, -COURT.kitchen, 0, 1), false);
  assert.equal(legalServe(-1, -1, 0, 1), false);
  assert.equal(legalServe(-COURT.halfWidth, -COURT.halfLength, 0, 1), true);
  assert.equal(legalServe(0, -5, 0, 1), true);
  assert.equal(legalServe(-3.2, -5, 0, 1), false);
  assert.equal(legalServe(1, 5, 1, -1), true);
});

test('traditional doubles starts 0–0–2, changes servers correctly, and never scores for the receiving team', () => {
  const score = new Score(); assert.equal(score.call, '0–0–2');
  score.award(1); assert.deepEqual(score.points, [0, 0]); assert.equal(score.team, 1); assert.equal(score.serverNumber, 1); assert.equal(score.server, 2);
  score.award(1); assert.deepEqual(score.points, [0, 1]); assert.equal(score.server, 2); assert.equal(score.serveRight, false);
  score.award(0); assert.deepEqual(score.points, [0, 1]); assert.equal(score.server, 3); assert.equal(score.serverNumber, 2); assert.equal(score.serveRight, true);
  score.award(0); assert.equal(score.team, 0); assert.equal(score.server, score.right[0]); assert.equal(score.serverNumber, 1);
});

test('only the serving partners swap after scoring; the designated receiver follows the diagonal', () => {
  const score = new Score(); assert.equal(score.receiver, 2);
  score.award(0); assert.deepEqual(score.right, [1, 2]); assert.equal(score.receiver, 3); assert.equal(score.server, 0);
  score.award(0); assert.deepEqual(score.right, [0, 2]); assert.equal(score.receiver, 2);
});

test('classic and quick scoring both require a two-point lead and stop once won', () => {
  for (const target of [5, 11]) {
    const score = new Score(target); score.points = [target - 1, target - 1];
    assert.equal(score.award(0).match, false); assert.equal(score.award(0).match, true);
    const final = [...score.points]; score.award(1); assert.deepEqual(score.points, final); assert.equal(score.winner, 0);
  }
});

test('the serve and return each have to bounce before volleys become legal', () => {
  const early = new Rally(0, 1, 2); assert.match(early.strike(player(2)).reason, /Two-bounce/);
  const rally = new Rally(0, 1, 2);
  assert.equal(rally.floor(-1, -5), null); assert.equal(rally.strike(player(2)), null);
  assert.match(rally.strike(player(0)).reason, /Two-bounce/);
  assert.equal(rally.floor(1, 5), null); assert.equal(rally.strike(player(0)), null);
  assert.equal(rally.strike(player(2)), null); assert.deepEqual(rally.mustBounce, [false, false]);
});

test('wrong receiver and short serve faults are distinct from a legal return', () => {
  const rally = new Rally(0, 1, 2); rally.floor(-1, -5);
  assert.match(rally.strike(player(3)).reason, /Wrong serve receiver/);
  const short = new Rally(0, 1, 2); assert.equal(short.floor(-1, -1).winner, 1);
});

test('kitchen line contact forbids volleys but permits groundstrokes', () => {
  const p = player(2, -(COURT.kitchen + COURT.footRadius)); assert.equal(inKitchen(p), true);
  const volley = new Rally(0, 1, 2); volley.serve = false; volley.mustBounce = [false, false];
  assert.match(volley.strike(p).reason, /Kitchen fault/);
  const bounced = new Rally(0, 1, 2); bounced.serve = false; bounced.mustBounce = [false, false];
  assert.equal(bounced.floor(0, -1), null); assert.equal(bounced.strike(player(2, -1)), null);
});

test('second bounce outside the court still wins for the hitter; first bounce out loses', () => {
  const rally = new Rally(0, 1, 2); rally.serve = false;
  assert.equal(rally.floor(1, -5), null); assert.equal(rally.floor(8, -10).winner, 0);
  const out = new Rally(0, 1, 2); out.serve = false; assert.equal(out.floor(8, -5).winner, 1);
});

test('all four physical service positions launch into their legal diagonal box', () => {
  for (let server = 0; server < 4; server++) {
    const game = new PickleballGame({ seed: 40 + server }); game.score.server = server; game.score.team = Math.floor(server / 2); game.prepareServe();
    assert.equal(game.serve(), true);
    for (let i = 0; i < 400 && game.stage === 'rally' && !game.rally.bounces; i++) game.step(STEP, { autoplay: true });
    assert.equal(game.stage, 'rally'); assert.equal(game.rally.bounces, 1); assert.equal(game.totalRallies, 0);
  }
});

test('kitchen momentum can reverse a provisional winning result before scoring', () => {
  const game = new PickleballGame(); game.serve(); const p = game.players[0];
  p.z = COURT.kitchen + .5; p.vz = -5; p.volley = true;
  game.resolve({ winner: 0, reason: 'Second bounce' });
  assert.deepEqual(game.score.points, [0, 0]); assert.equal(game.score.team, 1); assert.equal(game.message, 'Kitchen momentum fault');
});

test('swept net collision stops a fast low ball; pickleball does not rebound off walls', () => {
  const game = new PickleballGame(); game.serve();
  Object.assign(game.ball, { x: 0, y: .4, z: .2, vx: 0, vy: 0, vz: -80 }); game.step(STEP);
  assert.equal(game.stage, 'between'); assert.equal(game.message, 'Into the net');
  const out = new PickleballGame(); out.serve(); out.rally.serve = false;
  Object.assign(out.ball, { x: 4, y: .1, z: -5, vx: 1, vy: -3, vz: -1 }); out.step(STEP);
  assert.equal(out.stage, 'between'); assert.equal(out.message, 'Out');
});

test('pickleball matches finish with legal finite rallies and real shot variety at each difficulty', () => {
  for (const difficulty of ['casual', 'club', 'pro']) {
    const game = new PickleballGame({ difficulty, seed: 613 });
    for (let i = 0; i < 400000 && game.stage !== 'over'; i++) {
      game.step(STEP, { autoplay: true }); game.drainEvents();
      assert.ok(game.players.every(p => Number.isFinite(p.x + p.z + p.vx + p.vz)));
      assert.ok(Number.isFinite(game.ball.x + game.ball.y + game.ball.z));
    }
    assert.equal(game.stage, 'over', difficulty); assert.ok(Math.max(...game.score.points) >= 11);
    assert.ok(Math.abs(game.score.points[0] - game.score.points[1]) >= 2);
    assert.ok(game.stats.hits.every(n => n > 20)); assert.ok(game.stats.dinks.every(n => n > 0)); assert.ok(game.stats.volleys.every(n => n > 0)); assert.ok(game.bestRally > 5);
  }
});

test('assisted human held shots can play a complete quick game without autoplay', () => {
  const game = new PickleballGame({ target: 5, seed: 91 });
  for (let i = 0; i < 250000 && game.stage !== 'over'; i++) { game.step(STEP, { shot: 'drive', aim: { x: -1.7, z: -5.6 } }); game.drainEvents(); }
  assert.equal(game.stage, 'over'); assert.ok(game.stats.hits[0] > 10);
});

test('switch and tackle cannot take a football kickoff; pass can', () => {
  const game = new FootballGame();
  game.step(STEP, { action: 'switch' }); assert.equal(game.stage, 'kickoff');
  game.step(STEP, { action: 'tackle' }); assert.equal(game.stage, 'kickoff');
  game.step(STEP, { action: 'pass' }); assert.equal(game.stage, 'playing');
});

test('touch sprint is reachable without a keyboard and releases with the stick', () => {
  assert.equal(wantsSprint(new Set(), { x: .4, z: .3 }), false);
  assert.equal(wantsSprint(new Set(), { x: .6, z: .8 }), true);
  assert.equal(wantsSprint(new Set(), { x: 0, z: 0 }), false);
  assert.equal(wantsSprint(new Set(['ShiftRight'])), true);
});
