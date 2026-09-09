import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { cameraFrame, installViews } from '../shared/cameras.js';
import { movement } from '../shared/controls.js';
import { PadelGame } from '../padel/simulation.js';
import { FootballGame } from '../football/simulation.js';
import { WaterPoloGame } from '../waterpolo/simulation.js';
import { GolfGame } from '../golf/simulation.js';
import { PetancaGame } from '../petanca/simulation.js';
import { PickleballGame } from '../pickleball/simulation.js';
import { CurlingGame } from '../curling/simulation.js';
import { PoolGame } from '../pool/simulation.js';
import { ClimbingGame } from '../climbing/simulation.js';
import { SurfGame } from '../surf/simulation.js';
import { SkiGame } from '../ski/simulation.js';
import { SheepGame } from '../sheep/simulation.js';

const games = { padel: PadelGame, football: FootballGame, waterpolo: WaterPoloGame,
  golf: GolfGame, petanca: PetancaGame, pickleball: PickleballGame, curling: CurlingGame,
  pool: PoolGame, climbing: ClimbingGame, surf: SurfGame, ski: SkiGame, sheep: SheepGame };

test('all games provide distinct finite player-eye and overhead poses', () => {
  for (const [kind, Game] of Object.entries(games)) {
    const game = new Game(), pose = cameraFrame(kind, game);
    assert.ok([...pose.focus, ...pose.eye, ...pose.look].every(Number.isFinite), kind);
    assert.ok(pose.width > 0 && pose.depth > 0, kind);
    assert.ok(new THREE.Vector3(...pose.eye).distanceTo(new THREE.Vector3(...pose.look)) > .5, kind);
  }
});

test('the drawn camera is also the aiming camera; switching and resizing preserve the original view', () => {
  const previous = globalThis.document;
  class Element extends EventTarget { setAttribute() {} append() {} }
  globalThis.document = { createElement: () => new Element(), getElementById: () => null, querySelector: () => null };
  try {
    const base = new THREE.PerspectiveCamera(40, 1, .1, 500), player = new THREE.Group();
    let drawn, visibleDuringDraw, cleared = 0, width = 800;
    const canvas = { getBoundingClientRect: () => ({ width, height: 600 }), focus() {} };
    const view = { camera: base, canvas, players: [{ root: player }, { root: player }],
      renderer: { render(scene, camera) { drawn = camera; visibleDuringDraw = player.visible; } },
      resize() { this.camera.aspect = width / 600; this.camera.updateProjectionMatrix(); },
      render() { this.camera.position.set(10, 20, 25); this.camera.lookAt(0, 0, 0); this.renderer.render({}, this.camera); },
    };
    const g = new PadelGame(); g.controlled = 0;
    const controls = installViews(view, 'padel', () => cleared++);
    controls.setMode('first'); view.render(g);
    assert.equal(drawn, view.camera); assert.equal(visibleDuringDraw, false); assert.equal(player.visible, true);
    assert.notEqual(view.camera, base); assert.ok(view.camera.isPerspectiveCamera);
    const eye = cameraFrame('padel', g).eye;
    assert.ok(view.camera.position.distanceTo(new THREE.Vector3(...eye)) < 1e-9);
    controls.setMode('top'); view.render(g); assert.ok(drawn.isOrthographicCamera);
    const vector = movement(0, -1, view.camera); assert.ok(vector.moveZ < -.99);
    const target = new THREE.Vector3(1, 0, -3), projected = target.clone().project(view.camera);
    const ray = new THREE.Raycaster(); ray.setFromCamera(projected, view.camera);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    assert.ok(hit.distanceTo(target) < .001);
    width = 360; view.resize(); assert.equal(view.camera, drawn); assert.ok(view.camera.right > 0);
    controls.setMode('third'); view.render(g); assert.equal(view.camera, base); assert.equal(drawn, base);
    assert.equal(cleared, 3);
  } finally { globalThis.document = previous; }
});
