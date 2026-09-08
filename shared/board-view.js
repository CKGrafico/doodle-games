import * as THREE from '../vendor/three.module.min.js';
import { penMaterial } from './ink.js';
const BLUE = 0x2a42ad, RED = 0xc94b59, PAPER = 0xf7f4e9;
const v = (x, y, z) => new THREE.Vector3(x, y, z);
export class BoardView {
  constructor(canvas, kind) {
    this.canvas = canvas; this.kind = kind; this.close = false; this.meshes = new Map(); this.materials = new Map();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setClearColor(PAPER, 0);
    this.scene = new THREE.Scene(); this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 100);
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(v(0, 1, 0), 0); this.point = v(0, 0, 0);
    this.path = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: BLUE, dashSize: .12, gapSize: .08 })); this.scene.add(this.path);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(.2, .23, 40), new THREE.MeshBasicMaterial({ color: RED, side: THREE.DoubleSide }));
    this.marker.rotation.x = -Math.PI / 2; this.scene.add(this.marker);
    this.objects = new THREE.Group(); this.scene.add(this.objects);
    if (kind === 'curling') this.buildIce(); else this.buildTable();
    this.resize();
  }
  material(color, fill = .12) {
    const key = `${color}:${fill}`; if (!this.materials.has(key)) this.materials.set(key, penMaterial(color, fill)); return this.materials.get(key);
  }
  box(w, h, d, x, y, z, color = BLUE, fill = .1, parent = this.scene) {
    const geo = new THREE.BoxGeometry(w, h, d), mesh = new THREE.Mesh(geo, this.material(color, fill)); mesh.position.set(x, y, z);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color }))); parent.add(mesh); return mesh;
  }
  line(points, color = BLUE) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => v(...p))), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .6 })); this.scene.add(line); return line;
  }
  ring(inner, outer, x, z, color, y = .015) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 80), this.material(color, .5)); ring.rotation.x = -Math.PI / 2; ring.position.set(x, y, z); this.scene.add(ring); return ring;
  }
  label(text, size = .38, color = '#172867') {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.font = 'bold 82px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 64, 67);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false })); sprite.scale.set(size, size, 1); return sprite;
  }
  buildIce() {
    this.box(4.75, .15, 20, 0, -.09, 0, 0x679baa, .035);
    for (const x of [-2.5, 2.5]) this.box(.18, .28, 20.4, x, .03, 0);
    for (const z of [-10.1, 10.1]) this.box(5.1, .28, .18, 0, .03, z);
    for (const z of [-6.8, 6.8]) {
      this.ring(1.22, 1.83, 0, z, BLUE); this.ring(.61, 1.22, 0, z, PAPER); this.ring(.13, .61, 0, z, RED); this.ring(0, .13, 0, z, BLUE);
      this.line([[-2.37, .025, z], [2.37, .025, z]]);
    }
    this.line([[0, .025, -10], [0, .025, 10]]);
    for (const z of [-1.5, 1.5]) this.box(4.7, .008, .045, 0, .01, z, RED, .7);
    this.box(.6, .07, .12, 0, .04, 8.8);
    this.broom = new THREE.Group(); this.box(.65, .08, .18, 0, 0, 0, RED, .5, this.broom);
    this.box(.04, 1.2, .04, .1, .6, 0, BLUE, .3, this.broom); this.scene.add(this.broom);
  }
  buildTable() {
    this.box(5.6, .45, 10.6, 0, -.27, 0, BLUE, .2); this.box(4.8, .06, 9.6, 0, -.035, 0, 0x37837b, .22);
    for (const x of [-2.55, 2.55]) this.box(.3, .12, 9.9, x, .025, 0, BLUE, .4);
    for (const z of [-4.95, 4.95]) this.box(5.35, .12, .3, 0, .025, z, BLUE, .4);
    this.pocketMarks = [];
    for (const x of [-2.4, 2.4]) for (const z of [-4.8, 0, 4.8]) {
      this.ring(0, .27, x, z, 0x172035, .055);
      const label = this.label(String(this.pocketMarks.length + 1), .3); label.position.set(x * 1.14, .2, z); this.scene.add(label);
      this.pocketMarks.push({ x, z });
    }
    for (const x of [-2.57, 2.57]) for (const z of [-3.6, -2.4, -1.2, 1.2, 2.4, 3.6]) this.ring(0, .045, x, z, PAPER, .092);
    this.line([[-2.4, .015, 2.4], [2.4, .015, 2.4]], 0x417c80);
    this.cue = this.box(.045, .045, 2.2, 0, .16, 0, 0x997237, .42);
  }
  makeObject(b) {
    const group = new THREE.Group(), curling = this.kind === 'curling';
    const color = curling ? (b.team === 0 ? BLUE : RED) : [PAPER, 0xc5a42a, BLUE, RED, 0x795292, 0xcf7d39, 0x3a8879, 0x8b3c4b, 0x172035][b.id > 8 ? b.id - 8 : b.id];
    const geo = curling ? new THREE.CylinderGeometry(b.r * .91, b.r, .23, 28) : new THREE.SphereGeometry(b.r, 24, 16);
    const mesh = new THREE.Mesh(geo, this.material(curling ? 0x686e80 : b.id > 8 ? PAPER : color, curling ? .4 : .8)); group.add(mesh);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), new THREE.LineBasicMaterial({ color: curling ? BLUE : color, transparent: true, opacity: .4 })));
    if (curling) {
      this.box(.22, .055, .05, 0, .22, 0, color, .8, group);
      for (const x of [-.085, .085]) this.box(.04, .1, .04, x, .15, 0, color, .7, group);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .02, 24), this.material(color, .65)); top.position.y = .125; group.add(top);
    } else if (b.id) {
      if (b.id > 8) group.add(new THREE.Mesh(new THREE.SphereGeometry(b.r * 1.004, 24, 12, 0, Math.PI * 2, Math.PI * .3, Math.PI * .4), this.material(color, .8)));
      const number = this.label(String(b.id), b.r * 1.3, b.id === 8 ? '#ffffff' : '#172867'); number.position.y = b.r * 1.07; group.add(number);
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(b.r * 1.12, 28), new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: .12, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -b.r + .015; group.add(shadow);
    this.objects.add(group); return group;
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(); if (!r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false); const aspect = r.width / r.height;
    const height = this.kind === 'curling' ? (this.close ? 6.5 : Math.max(21, 6 / aspect)) : Math.max(11.8, 6.4 / aspect);
    this.camera.left = -height * aspect / 2; this.camera.right = height * aspect / 2; this.camera.top = height / 2; this.camera.bottom = -height / 2;
    const focus = this.kind === 'curling' && this.close ? -6.5 : 0;
    this.camera.position.set(0, 25, focus + (this.kind === 'curling' ? 8 : this.close ? .01 : 9)); this.camera.lookAt(0, 0, focus); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }
  aimAt(x, y) {
    const r = this.canvas.getBoundingClientRect(); this.ray.setFromCamera({ x: (x - r.left) / r.width * 2 - 1, y: 1 - (y - r.top) / r.height * 2 }, this.camera);
    if (!this.ray.ray.intersectPlane(this.plane, this.point)) return null; return { x: this.point.x, z: this.point.z };
  }
  render(game, now = 0) {
    const bodies = game.stones ?? game.balls;
    if (this.lastGame !== game || this.round !== game.endNumber) {
      // Dispose per-object geometry/textures on rematch/end, retaining shared materials.
      this.objects.traverse(o => { o.geometry?.dispose(); if (o.material && !o.material.isShaderMaterial) { o.material.map?.dispose(); o.material.dispose(); } });
      this.objects.clear(); this.meshes.clear(); this.lastGame = game; this.round = game.endNumber;
    }
    const live = new Set();
    for (const b of bodies) {
      live.add(b.id); if (!this.meshes.has(b.id)) this.meshes.set(b.id, this.makeObject(b));
      const mesh = this.meshes.get(b.id); mesh.visible = !b.dead; mesh.position.set(b.x, this.kind === 'curling' ? .12 : b.r, b.z);
    }
    for (const [id, mesh] of this.meshes) if (!live.has(id)) mesh.visible = false;
    this.path.visible = game.stage === 'aim' && game.human; this.marker.visible = this.path.visible || game.stage === 'place';
    if (this.path.visible) {
      const preview = game.preview(); if (this.previousPath !== preview) {
        this.path.geometry.dispose(); this.path.geometry = new THREE.BufferGeometry().setFromPoints(preview.path.map(p => v(p.x, .06, p.z))); this.path.computeLineDistances(); this.previousPath = preview;
      }
      this.marker.position.set(preview.end.x, .04, preview.end.z);
    } else if (game.stage === 'place') this.marker.position.set(game.placement.x, .04, game.placement.z);
    if (this.broom) {
      this.broom.visible = game.stage === 'rolling' && game.sweeping;
      if (this.broom.visible) this.broom.position.set(game.active.x + Math.sin(now * 24) * .3, .06, game.active.z - .5);
    }
    if (this.cue) {
      this.cue.visible = game.stage === 'aim' && game.human;
      const ball = game.balls[0], length = 1.35 + game.power * .4;
      this.cue.position.set(ball.x - Math.sin(game.angle) * length, .15, ball.z - Math.cos(game.angle) * length); this.cue.rotation.y = game.angle;
      if (game.calledPocket >= 0 && game.stage === 'aim') { const p = this.pocketMarks[game.calledPocket]; this.marker.position.set(p.x, .1, p.z); }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
