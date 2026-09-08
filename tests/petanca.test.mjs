import test from 'node:test';
import assert from 'node:assert/strict';
import { PetancaGame, STEP, scoreEnd, nextTeam, collide, trajectory } from '../petanca/simulation.js';
const jack = { x: 0, z: 0 };
const ball = (team, x) => ({ id: team + ':' + x, team, x, z: 0, dead: false });
test('only boules ahead of the opposing best score, with ties worth zero', () => {
  assert.deepEqual(scoreEnd([ball(0, .2), ball(0, .4), ball(1, .5), ball(0, .8)], jack), { team: 0, points: 2 });
  assert.deepEqual(scoreEnd([ball(0, .2), ball(1, -.2)], jack), { team: null, points: 0 });
  assert.deepEqual(scoreEnd([{ ...ball(0, .01), dead: true }, ball(1, .3)], jack), { team: 1, points: 1 });
});
test('the losing side continues until it takes the point or exhausts its boules', () => {
  assert.equal(nextTeam([ball(0, .2), ball(1, .6)], jack, [2, 2], 1), 1);
  assert.equal(nextTeam([ball(0, .2), ball(1, .6)], jack, [2, 0], 1), 0);
  assert.equal(nextTeam([], jack, [0, 0], 0), null);
});
test('steel boule collision transfers momentum to the target', () => {
  const a = { x: 0, y: .12, z: 0, vx: 3, vy: 0, vz: 0, r: .12, mass: 1 };
  const b = { ...a, x: .23, vx: 0 };
  assert.equal(collide(a, b), true); assert.ok(b.vx > 2); assert.ok(a.vx < 1); assert.ok(Math.abs(a.vx + b.vx - 3) < 1e-8);
});
test('three trajectories reach their nominal empty-lane distance', () => {
  for (const mode of ['point', 'lob', 'shoot']) { const p = trajectory(8, mode); assert.ok(Math.abs(6.3 - p.end.z - 8) < .04); assert.ok(p.path.some(b => b.y > .7)); }
});
test('jack boundary rules finish the end and award only the remaining eligible boules', () => {
  const g = new PetancaGame(); g.jack.dead = true; g.remaining = [2, 0]; g.settle(); assert.deepEqual(g.scores, [2, 0]);
  const n = new PetancaGame(); n.jack.dead = true; n.remaining = [1, 1]; n.settle(); assert.deepEqual(n.scores, [0, 0]); assert.equal(n.stage, 'end');
});
test('a deterministic match with collisions progresses through ends to 13', () => {
  const g = new PetancaGame({ seed: 721 }); let throws = 0;
  for (let i = 0; i < 400000 && g.stage !== 'over'; i++) {
    if (g.stage === 'jack') { g.reach = 8; assert.equal(g.placeJack(), true); }
    if (g.stage === 'aim' && g.turn === 0) { g.aimJack(); g.mode = ['point', 'lob', 'shoot'][throws++ % 3]; g.shoot(); }
    if (g.stage === 'end') g.nextEnd();
    g.step(STEP); g.drainEvents();
    assert.ok(g.remaining.every(n => n >= 0 && n <= 3));
    assert.ok([...g.balls, g.jack].every(b => Number.isFinite(b.x + b.y + b.z)));
  }
  assert.equal(g.stage, 'over'); assert.ok(g.scores.some(n => n >= 13)); assert.ok(throws > 3);
});
