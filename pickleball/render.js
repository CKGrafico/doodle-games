import * as THREE from '../vendor/three.module.min.js';
import { penMaterial } from '../shared/ink.js';
import { makeRacketPlayer, animateRacketPlayers } from '../shared/racket-player.js';
import { COURT, clamp, netHeight } from './rules.js';
const BLUE = 0x2a42ad, RED = 0xc94b59, PAPER = 0xf7f4e9, GOLD = 0xc1aa24, GREY = 0x64708c;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class PickleballView {
  constructor(canvas) {
    this.canvas = canvas; this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); this.renderer.setClearColor(PAPER, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(39, 1, .1, 150);
    this.camera.position.set(10, 16, 21); this.camera.lookAt(0, 0, 0);
    this.materials = new Map(); this.mode = 'raised'; this.lobby = true; this.trail = [];
    this.ray = new THREE.Raycaster(); this.ground = new THREE.Plane(V(0, 1, 0), 0); this.point = V();
    this.buildCourt(); this.buildDistrict();
    this.players = Array.from({ length: 4 }, (_, id) => makeRacketPlayer(this, id < 2 ? BLUE : RED, id, { perforated: false }));
    const radius = COURT.ballRadius * 1.35;
    this.ball = this.mesh(new THREE.SphereGeometry(radius, 18, 12), GOLD, .78, true);
    for (let i = 0; i < 20; i++) {
      const y = 1 - (i + .5) / 10, angle = i * 2.39996, r = Math.sqrt(1 - y * y), direction = V(Math.cos(angle) * r, y, Math.sin(angle) * r);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(.016, 7), new THREE.MeshBasicMaterial({ color: BLUE }));
      hole.position.copy(direction).multiplyScalar(radius * 1.01); hole.quaternion.setFromUnitVectors(V(0, 0, 1), direction); this.ball.add(hole);
    }
    this.scene.add(this.ball); this.shadow = this.disk(.15, BLUE, .2); this.scene.add(this.shadow);
    this.active = this.ring(.43, BLUE); this.target = this.ring(.23, RED); this.scene.add(this.active, this.target);
    this.serveBox = new THREE.Mesh(new THREE.PlaneGeometry(COURT.halfWidth, COURT.halfLength - COURT.kitchen), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: .14, depthWrite: false }));
    this.serveBox.rotation.x = -Math.PI / 2; this.scene.add(this.serveBox);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(28 * 3), 3)); geometry.setDrawRange(0, 0);
    this.trailLine = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: .65 }));
    this.trailLine.frustumCulled = false; this.scene.add(this.trailLine); this.resize();
  }
  mat(color, fill) {
    const key = `${color}:${fill}`; if (!this.materials.has(key)) this.materials.set(key, penMaterial(color, fill)); return this.materials.get(key);
  }
  mesh(geometry, color = BLUE, fill = .05, round = false) {
    const mesh = new THREE.Mesh(geometry, this.mat(color, fill));
    if (round) { const shell = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })); shell.scale.setScalar(1.045); mesh.add(shell); }
    else mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 24), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .8 })));
    return mesh;
  }
  box(w, h, d, color = BLUE, fill = .05) { return this.mesh(new THREE.BoxGeometry(w, h, d), color, fill); }
  disk(radius, color, opacity) {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })); mesh.rotation.x = -Math.PI / 2; return mesh;
  }
  ring(radius, color) {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(radius - .018, radius + .018, 40), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })); mesh.rotation.x = -Math.PI / 2; return mesh;
  }
  line(points, color = BLUE, opacity = 1) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => V(...p))), new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })); this.scene.add(line); return line;
  }
  bar(a, b, radius = .025, color = BLUE) {
    const start = V(...a), end = V(...b), mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, start.distanceTo(end), 7), new THREE.MeshBasicMaterial({ color }));
    mesh.position.copy(start).add(end).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(V(0, 1, 0), end.sub(start).normalize()); this.scene.add(mesh);
  }
  lettering(text, x, y, z, width, color = BLUE) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.font = '72px Patrick, cursive'; ctx.fillStyle = '#' + color.toString(16).padStart(6, '0'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 384, 64);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 6), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); this.scene.add(mesh);
  }
  buildCourt() {
    const { halfWidth: w, halfLength: l, kitchen: k } = COURT;
    const surround = this.box(11, .1, 20, GREY, .015); surround.position.y = -.13; this.scene.add(surround);
    const court = this.box(w * 2, .06, l * 2, BLUE, .065); court.position.y = -.045; this.scene.add(court);
    for (const s of [-1, 1]) {
      const zone = new THREE.Mesh(new THREE.PlaneGeometry(w * 2, k), this.mat(RED, .065)); zone.rotation.x = -Math.PI / 2; zone.position.set(0, .003, s * k / 2); this.scene.add(zone);
      this.line([[-w, .025, s * k], [w, .025, s * k]], RED);
      this.line([[0, .025, s * k], [0, .025, s * l]]);
      this.lettering('THE KITCHEN', 0, .016, s * 1.05, 2.1, RED);
      for (let x = -w; x < w; x += .24) this.line([[x, .02, s * k], [x + .09, .02, s * (k - .12)]], RED, .35);
    }
    this.line([[-w, .025, -l], [w, .025, -l], [w, .025, l], [-w, .025, l], [-w, .025, -l]]);
    for (const x of [-w - .16, w + .16]) this.bar([x, 0, 0], [x, 1.02, 0], .045);
    const top = []; for (let x = -w; x <= w + .01; x += w / 20) top.push([x, netHeight(x), 0]); this.line(top);
    for (let x = -w; x <= w; x += .19) this.line([[x, .04, 0], [x, netHeight(x), 0]], BLUE, .55);
    for (let y = .12; y < .86; y += .14) this.line([[-w, y, 0], [w, y, 0]], BLUE, .5);
    this.lettering('PICKLEBALL DISTRICT', 0, .01, -8.1, 4.2);
    this.lettering('06 / SOFT HANDS, SHARP ANGLES', 0, .01, 8.8, 3.9, GREY);
  }
  buildDistrict() {
    for (const x of [-5, 5]) {
      const bench = this.box(.65, .12, 2.5, GREY); bench.position.set(x, .5, 2.5); this.scene.add(bench);
      const back = this.box(.08, .5, 2.5, GREY); back.position.set(x + Math.sign(x) * .3, .75, 2.5); this.scene.add(back);
      for (const z of [1.5, 3.5]) this.bar([x, 0, z], [x, .45, z], .035, GREY);
      this.bar([x, 0, -6], [x, 5, -6], .035, GREY); this.bar([x, 5, -6], [x - Math.sign(x) * .75, 5, -6], .03, GREY);
      const lamp = this.box(.8, .13, .4, GREY); lamp.position.set(x - Math.sign(x) * .4, 5, -6); this.scene.add(lamp);
      const tree = this.mesh(new THREE.IcosahedronGeometry(.85, 1), GREY, .04, true); tree.position.set(x, 2, 7); tree.scale.y = 1.4; this.scene.add(tree); this.bar([x, 0, 7], [x, 1.6, 7], .065, GREY);
    }
    for (let i = 0; i < 4; i++) {
      const h = 2.6 + (i % 3) * .8, building = this.box(2.8, h, 2, GREY, .01); building.position.set((i - 1.5) * 3.6, h / 2, -12.5); this.scene.add(building);
      for (const x of [-.75, .75]) for (let y = .8; y < h; y += 1.05) { const window = this.box(.55, .55, .025, GREY, .1); window.position.set(x, y - h / 2, 1.025); building.add(window); }
    }
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(); this.width = rect.width; this.height = rect.height;
    this.renderer.setSize(this.width, this.height, false); this.camera.aspect = this.width / this.height; this.camera.updateProjectionMatrix();
  }
  setLobby(value) { this.lobby = value; this.trail = []; }
  aimAt(x, y) {
    const r = this.canvas.getBoundingClientRect(); this.ray.setFromCamera({ x: (x - r.left) / r.width * 2 - 1, y: 1 - (y - r.top) / r.height * 2 }, this.camera);
    if (!this.ray.ray.intersectPlane(this.ground, this.point)) return null;
    return { x: clamp(this.point.x, -2.8, 2.8), z: clamp(this.point.z, -6.25, -.9) };
  }
  render(game, dt, time) {
    const mobile = this.width < 650, end = this.mode === 'end';
    const camera = mobile ? V(2, 20, 23) : end ? V(0, 14, 23) : V(10, 16, 21);
    this.camera.position.lerp(camera, 1 - Math.exp(-dt * 4)); this.camera.lookAt(0, 0, 0);
    if (this.lobby && !mobile) this.camera.setViewOffset(this.width, this.height, -this.width * .16, 0, this.width, this.height); else this.camera.clearViewOffset();
    this.camera.fov = mobile ? 46 : 39; this.camera.updateProjectionMatrix();
    animateRacketPlayers(this.players, game, dt, time);
    const b = game.ball, p = game.players[game.controlled]; this.ball.position.set(b.x, b.y, b.z); this.ball.rotation.x += dt * 4; this.ball.rotation.z += dt * 2;
    this.shadow.position.set(b.x, .03, b.z); this.shadow.scale.setScalar(1 + b.y * .12);
    this.active.visible = this.target.visible = !this.lobby;
    this.active.position.set(p.x, .03, p.z); this.target.position.set(game.aim.x, .035, game.aim.z);
    this.serveBox.visible = !this.lobby && game.stage === 'ready';
    const receiver = game.players[game.receiver]; this.serveBox.position.set(Math.sign(receiver.x) * COURT.halfWidth / 2, .018, Math.sign(receiver.z) * (COURT.kitchen + COURT.halfLength) / 2);
    if (game.stage === 'rally') { this.trail.unshift(V(b.x, b.y, b.z)); this.trail.length = Math.min(28, this.trail.length); } else this.trail.length = 0;
    const attr = this.trailLine.geometry.attributes.position; this.trail.forEach((v, i) => attr.setXYZ(i, v.x, v.y, v.z)); attr.needsUpdate = true; this.trailLine.geometry.setDrawRange(0, this.trail.length);
    this.renderer.render(this.scene, this.camera);
    const q = V(p.x, 2.05, p.z).project(this.camera); return { x: (q.x + 1) * this.width / 2, y: (1 - q.y) * this.height / 2 };
  }
}
