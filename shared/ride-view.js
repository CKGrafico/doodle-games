import * as THREE from '../vendor/three.module.min.js';
import { penMaterial, outlineMeshes } from './ink.js';
import { clamp, damp } from './ride-physics.js';
const BLUE = 0x2a42ad, RED = 0xc94b59, PAPER = 0xf7f4e9;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class RideView {
  constructor(canvas, kind) {
    this.canvas = canvas; this.kind = kind; this.width = 1; this.height = 1; this.lobby = true;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.renderer.setClearColor(PAPER, 0);
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(47, 1, .1, 220);
    this.camera.position.set(0, 12, 17); this.focus = V(0, 0, -9); this.desired = V();
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(V(0, 1, kind === 'ski' ? -.16 : 0), 0); this.point = V();
    this.materials = [penMaterial(BLUE, kind === 'surf' ? .18 : .025), penMaterial(BLUE, .5), penMaterial(RED, .52), penMaterial(0x596070, .5)];
    this.track = new THREE.Mesh(new THREE.PlaneGeometry(kind === 'surf' ? 60 : 30, 150, kind === 'surf' ? 90 : 30, 50), this.materials[0]);
    this.track.rotation.x = -Math.PI / 2; this.track.position.z = -50; this.scene.add(this.track);
    this.rider = this.makeRider(1); this.rivalModels = kind === 'ski' ? [this.makeRider(2), this.makeRider(3), this.makeRider(1)] : [];
    this.gates = []; this.features = []; this.rocks = []; this.lastCourse = null;
    this.courseGroup = new THREE.Group(); this.scene.add(this.courseGroup);
    this.scenery = [];
    for (let i = 0; i < 36; i++) {
      const group = new THREE.Group(); this.scene.add(group);
      const side = i % 2 ? -1 : 1; group.position.x = side * (kind === 'surf' ? 7.5 : 10 + i % 4);
      if (kind === 'ski') {
        const trunk = this.mesh(new THREE.CylinderGeometry(.13, .18, 1.5, 5), 3, group); trunk.position.y = .65;
        for (let j = 0; j < 3; j++) {
          const crown = this.mesh(new THREE.ConeGeometry(1.1 - j * .22, 2, 6), j % 2 ? 0 : 1, group); crown.position.y = 1.7 + j * .8;
        }
      } else {
        const buoy = this.mesh(new THREE.SphereGeometry(.16, 7, 5), 2, group); buoy.position.y = .15;
      }
      this.scenery.push(group);
    }
    // Ink lines move down the field even while the rider holds a steady line.
    this.speedLines = [];
    for (let i = 0; i < 36; i++) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(), V(0, 0, -2 - i % 4)]),
        new THREE.LineBasicMaterial({ color: kind === 'surf' ? 0xffffff : BLUE, transparent: true, opacity: .35 }));
      line.position.x = -8 + (i * 7 % 160) / 10; this.scene.add(line); this.speedLines.push(line);
    }
    this.trailPoints = new Float32Array(90 * 3);
    this.trailGeometry = new THREE.BufferGeometry(); this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPoints, 3));
    this.trail = new THREE.Line(this.trailGeometry, new THREE.LineBasicMaterial({ color: kind === 'surf' ? 0xffffff : BLUE, transparent: true, opacity: .6 }));
    this.scene.add(this.trail); this.history = [];
    if (kind === 'surf') {
      // A moving breaking crest makes the wave readable as a face and shoulder.
      this.breakingCurl = new THREE.Group(); this.scene.add(this.breakingCurl);
      for (let i = 0; i < 30; i++) {
        const foam = this.mesh(new THREE.SphereGeometry(1, 9, 6), 0, this.breakingCurl);
        foam.position.set(-.5 + i % 6 * 1.05, 1.8 + Math.sin(i % 6 / 5 * Math.PI) * 2, Math.floor(i / 6) * 1.8);
        foam.scale.set(.8, .65, 1.4);
      }
      const crest = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({length:81}, (_, i) => V(5.5, this.heightAt(5.5, 0), 20-i*1.6))), new THREE.LineBasicMaterial({color:0xffffff, transparent:true, opacity:.8}));
      this.scene.add(crest);
    }
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(.65, 18), new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: .17, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.scene.add(this.shadow);
    this.spray = [];
    for (let i = 0; i < 24; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(.06, 4, 3), new THREE.MeshBasicMaterial({ color: kind === 'surf' ? 0xffffff : BLUE, transparent: true, opacity: .6 }));
      this.scene.add(drop); this.spray.push(drop);
    }
    this.shake = 0; this.lastStamp = -1; this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
  }
  mesh(geometry, index = 0, parent = this.scene) { const mesh = new THREE.Mesh(geometry, this.materials[index]); parent.add(mesh); return mesh; }
  makeRider(color) {
    const root = new THREE.Group(); this.scene.add(root);
    const body = new THREE.Group(); root.add(body); root.userData.body = body;
    const torso = this.mesh(new THREE.CapsuleGeometry(.27, .45, 4, 9), color, body); torso.position.y = 1.16;
    const head = this.mesh(new THREE.SphereGeometry(.25, 12, 8), 0, body); head.position.y = 1.85;
    const helmet = this.mesh(new THREE.SphereGeometry(.26, 12, 8, 0, Math.PI * 2, 0, 1.55), color, body); helmet.position.y = 1.88;
    root.userData.legs = []; root.userData.arms = [];
    for (const side of [-1, 1]) {
      const leg = this.mesh(new THREE.CapsuleGeometry(.105, .47, 3, 7), color, root); leg.position.set(side * .24, .52, .06); leg.rotation.x = -.3; root.userData.legs.push(leg);
      const arm = this.mesh(new THREE.CapsuleGeometry(.075, .55, 3, 7), 0, body); arm.position.set(side * .48, 1.2, -.1); arm.rotation.z = side * .8; root.userData.arms.push(arm);
      if (this.kind === 'ski') {
        const ski = this.mesh(new THREE.BoxGeometry(.17, .07, 2.1), color, root); ski.position.set(side * .26, .1, -.2);
        const tip = this.mesh(new THREE.BoxGeometry(.17, .07, .35), color, root); tip.position.set(side * .26, .17, -1.35); tip.rotation.x = .35;
        const pole = this.mesh(new THREE.CylinderGeometry(.025, .025, 1.45, 5), color, body); pole.position.set(side * .8, .6, .35); pole.rotation.x = -.35;
      }
    }
    if (this.kind === 'surf') {
      const board = this.mesh(new THREE.SphereGeometry(1, 16, 8), 2, root); board.scale.set(.43, .09, 1.45); board.position.y = .08;
      const fin = this.mesh(new THREE.BoxGeometry(.04, .3, .3), color, root); fin.position.set(0, -.1, .65);
    }
    outlineMeshes(root); return root;
  }
  heightAt(x, z, progress = 0) {
    if (this.kind === 'ski') return z * .16;
    const face = x <= 5.5 ? Math.pow(Math.max(0, x + 1.5), 1.65) * .2 : Math.max(0, 4.96 - (x - 5.5) * .9);
    return face + .12 * Math.sin((z + progress) * .3);
  }
  label(text, color = BLUE) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#f7f4e9'; ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0'); ctx.font = '48px Patrick'; ctx.textAlign = 'center'; ctx.fillText(text, 256, 64);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    sprite.scale.set(5.5, 1.05, 1); return sprite;
  }
  clearCourse() {
    this.courseGroup.traverse(object => {
      object.geometry?.dispose();
      if (object.isSprite) { object.material.map?.dispose(); object.material.dispose(); }
      if (object.userData.ownMaterial) object.material.dispose();
    });
    this.courseGroup.clear(); this.gates = []; this.features = []; this.rocks = [];
  }
  buildCourse(game) {
    this.clearCourse(); this.lastCourse = game.kind + ':' + game.course + ':' + (game.wave ?? 0);
    if (this.kind === 'ski') {
      game.gates.forEach((gate, i) => {
        const group = new THREE.Group(); this.courseGroup.add(group);
        for (const side of [-1, 1]) {
          const post = this.mesh(new THREE.CylinderGeometry(.035, .04, 1.8, 5), i % 2 ? 1 : 2, group); post.position.set(side * game.config.width, .9, 0);
          const flag = this.mesh(new THREE.BoxGeometry(.6, .5, .025), i % 2 ? 1 : 2, group); flag.position.set(side * (game.config.width - .3), 1.45, 0);
        }
        this.gates.push(group);
      });
      game.features.forEach(feature => {
        const group = new THREE.Group(); this.courseGroup.add(group);
        if (feature.type === 'ramp') {
          const ramp = this.mesh(new THREE.BoxGeometry(feature.width * 2, .3, 5), 2, group); ramp.rotation.x = .25; ramp.position.set(0, .7, 1);
          const label = this.label('JUMP ↗', RED); label.position.y = 3; group.add(label);
        } else {
          for (let i = 0; i < 3; i++) {
            const ring = this.mesh(new THREE.TorusGeometry(1.1, .07, 5, 20, Math.PI), 1, group); ring.position.set(0, .05, i * 1.2);
          }
          const label = this.label('BOOST'); label.position.y = 2.5; group.add(label);
        }
        this.features.push(group);
      });
      game.rocks.forEach(() => { const rock = this.mesh(new THREE.DodecahedronGeometry(.8), 3, this.courseGroup); rock.scale.y = .7; this.rocks.push(rock); });
      this.finish = new THREE.Group(); this.courseGroup.add(this.finish);
      for (const side of [-1, 1]) { const post = this.mesh(new THREE.BoxGeometry(.15, 4, .15), 2, this.finish); post.position.set(side * 8, 2, 0); }
      const banner = this.label('FINISH'); banner.position.y = 4; banner.scale.x = 14; this.finish.add(banner);
    } else {
      game.sections.forEach(section => {
        const group = new THREE.Group(); this.courseGroup.add(group);
        const length = section.end - section.z;
        if (section.type === 'tube') {
          const geometry = new THREE.PlaneGeometry(1, 1, 18, 10), pos = geometry.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const angle = (pos.getX(i) + .5) * Math.PI;
            const z = -(pos.getY(i) + .5) * length;
            pos.setXYZ(i, section.x + Math.cos(angle) * 2.5, 1.7 + Math.sin(angle) * 2.3, z);
          }
          geometry.computeVertexNormals();
          const tube = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: .15, side: THREE.DoubleSide, depthWrite: false }));
          tube.userData.ownMaterial = true; group.add(tube);
          for (let j = 0; j <= 8; j++) {
            const points = Array.from({ length: 25 }, (_, i) => { const a = i / 24 * Math.PI; return V(section.x + Math.cos(a) * 2.5, 1.7 + Math.sin(a) * 2.3, -j * length / 8); });
            const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: BLUE, transparent: true, opacity: .45 }));
            line.userData.ownMaterial = true; group.add(line);
          }
        } else {
          for (let i = 0; i < 6; i++) {
            const lip = this.mesh(new THREE.ConeGeometry(.2, .75, 4), 2, group);
            lip.position.set(4.9, this.heightAt(4.9, 0) + .65, -i * length / 6);
          }
        }
        const label = this.label(section.type === 'tube' ? 'BARREL' : 'LAUNCH ZONE', section.type === 'tube' ? BLUE : RED);
        label.position.set(section.x, 6.5, 0); group.add(label); this.features.push(group);
      });
      game.foam.forEach(() => {
        const foam = this.mesh(new THREE.SphereGeometry(1, 10, 5), 0, this.courseGroup); foam.scale.set(1.1, .3, 1.8); this.rocks.push(foam);
      });
    }
    this.history.length = 0;
  }
  setLobby(value) { this.lobby = value; }
  burst(type) { if (!this.reducedMotion) this.shake = type === 'crash' ? .45 : type === 'pump' ? .13 : .08; }
  resize() {
    const r = this.canvas.getBoundingClientRect(); if (!r.width || !r.height) return;
    this.width = r.width; this.height = r.height; this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix();
  }
  aimLane(x, y) {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera({ x: (x - r.left) / r.width * 2 - 1, y: 1 - (y - r.top) / r.height * 2 }, this.camera);
    return this.ray.ray.intersectPlane(this.plane, this.point) ? clamp(this.point.x, -5.4, 5.4) : 0;
  }
  placeRider(model, rider, game, time) {
    const z = -(rider.z - game.z), base = this.heightAt(rider.x, z, game.z);
    const jump = rider.air ? Math.sin(Math.PI * (1 - rider.air / rider.airDuration)) * (1.5 + rider.airDuration) : 0;
    model.position.set(rider.x, base + jump, z); model.rotation.y = (rider.air ? rider.spin : this.kind === 'surf' ? -rider.heading : -rider.vx * .045);
    model.rotation.z = rider.air ? 0 : -rider.vx * .045; model.rotation.x = this.kind === 'ski' ? -.13 : 0;
    model.visible = z > -130 && z < 22;
    // A fallen rider stays visible and slides, rather than blinking out of existence.
    if (rider.recovery) { model.rotation.z = -1.2; model.position.y = base + .4; }
    const crouch = rider.air ? .25 : rider.crouch ? rider.crouch * .35 : (rider.boost ? .25 : .08);
    model.userData.body.position.y = -crouch + Math.sin(time * 12) * .025;
    model.userData.body.rotation.x = rider.air && rider.grabTime > .1 ? .55 : .15;
    model.userData.arms.forEach((arm, i) => arm.rotation.z = (i ? 1 : -1) * (rider.air ? 1.15 : .65));
  }
  render(game, dt = 0, time = 0) {
    const key = game.kind + ':' + game.course + ':' + (game.wave ?? 0);
    if (key !== this.lastCourse) this.buildCourse(game);
    const surf = this.kind === 'surf', positions = this.track.geometry.attributes.position;
    // Wave shape changes at 30 Hz; static snow is only shaped once per course.
    if (!this.surfaceReady || (surf && Math.floor(time * 30) !== this.lastStamp)) {
      for (let i = 0; i < positions.count; i++) positions.setZ(i, this.heightAt(positions.getX(i), -positions.getY(i) - 50, game.z));
      positions.needsUpdate = true; this.track.geometry.computeVertexNormals(); this.lastStamp = Math.floor(time * 30); this.surfaceReady = true;
    }
    this.placeRider(this.rider, game, game, time);
    if (!surf) game.rivals.forEach((r, i) => this.placeRider(this.rivalModels[i], r, game, time));
    this.shadow.position.set(game.x, this.heightAt(game.x, 0, game.z) + .03, 0);
    this.shadow.scale.setScalar(game.air ? 1.5 : 1);
    for (let i = 0; i < this.scenery.length; i++) {
      const object = this.scenery[i], z = 15 - ((i * 4.8 + game.z) % 170);
      object.position.z = z; object.position.y = this.heightAt(object.position.x, z, game.z);
    }
    this.speedLines.forEach((line, i) => {
      const z = 12 - ((i * 4.1 + game.z) % 140);
      line.position.set(line.position.x, this.heightAt(line.position.x, z, game.z) + .04, z);
    });
    if (surf) {
      this.breakingCurl.position.z = game.shoulder;
      this.breakingCurl.rotation.z = Math.sin(time * 3) * .025;
      game.sections.forEach((section, i) => { this.features[i].position.z = -(section.z - game.z); this.features[i].visible = section.end > game.z - 10 && section.z < game.z + 110; });
      game.foam.forEach((foam, i) => { const z = -(foam.z - game.z); this.rocks[i].position.set(foam.x, this.heightAt(foam.x, z, game.z) + .12, z); });
    } else {
      game.gates.forEach((gate, i) => { const z = -(gate.z - game.z); this.gates[i].position.set(gate.x, z * .16, z); this.gates[i].visible = z < 10 && z > -130; });
      game.features.forEach((feature, i) => { const z = -(feature.z - game.z); this.features[i].position.set(feature.x, z * .16, z); this.features[i].visible = z < 15 && z > -130; });
      game.rocks.forEach((rock, i) => { const z = -(rock.z - game.z); this.rocks[i].position.set(rock.x, .5 + z * .16, z); });
      const z = -(game.length - game.z); this.finish.position.set(0, z * .16, z); this.finish.visible = z > -130;
    }
    if (game.stage === 'riding' && !game.air && !game.recovery) {
      this.history.unshift({ x: game.x, z: game.z }); if (this.history.length > 90) this.history.pop();
    }
    for (let i = 0; i < 90; i++) {
      const point = this.history[Math.min(i, this.history.length - 1)] ?? { x: game.x, z: game.z };
      const z = game.z - point.z; this.trailPoints[i * 3] = point.x; this.trailPoints[i * 3 + 1] = this.heightAt(point.x, z, game.z) + .05; this.trailPoints[i * 3 + 2] = z;
    }
    this.trailGeometry.attributes.position.needsUpdate = true; this.trailGeometry.computeBoundingSphere();
    this.spray.forEach((drop, i) => {
      const age = ((time * 2.5 + i / 24) % 1);
      drop.visible = !game.air && !game.recovery && game.stage === 'riding';
      drop.position.set(game.x + Math.sin(i * 5) * age * .8 - game.vx * age * .15, this.heightAt(game.x, 0, game.z) + Math.sin(age * Math.PI) * .65, .6 + age * 2.3);
      drop.scale.setScalar(1 - age);
    });
    const portrait = this.camera.aspect < .8;
    const cameraY = surf ? 11 : 12, cameraZ = surf ? 17 : 18;
    this.desired.set(surf ? game.x * .25 - 12 : game.x * .18, surf ? (portrait ? 12 : 8) : portrait ? 17 : cameraY, surf ? (portrait ? 21 : 14) : portrait ? 23 : cameraZ);
    this.camera.position.lerp(this.desired, 1 - Math.exp(-Math.max(dt, .001) * 6));
    this.shake = Math.max(0, this.shake - dt * 1.7);
    this.focus.set(game.x * .35 + Math.sin(time * 60) * this.shake * .25, surf ? 2 : -1.6, surf ? -3 : -9);
    this.camera.lookAt(this.focus);
    const fov = this.reducedMotion ? 47 : 47 + Math.min(5, Math.max(0, game.speed - 18) * .3);
    this.camera.fov = damp(this.camera.fov, fov, 3, Math.max(dt, .001)); this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
}
