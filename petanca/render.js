import * as THREE from '../vendor/three.module.min.js';
import { LANE, trajectory, ranking } from './simulation.js';
const BLUE = 0x2a42ad, RED = 0xc94b59, PAPER = 0xf7f4e9, GOLD = 0xb49b1b;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
import { penMaterial as pen } from '../shared/ink.js';

export class PetancaView {
  constructor(canvas) {
    this.canvas = canvas; this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); this.renderer.setClearColor(PAPER, 0);
    this.scene = new THREE.Scene(); this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 100);
    this.ray = new THREE.Raycaster(); this.plane = new THREE.Plane(V(0, 1, 0), 0); this.point = V(); this.close = false;
    this.materials = new Map(); this.ballMeshes = new Map(); this.pathKey = '';
    this.buildCourt(); this.ballsGroup = new THREE.Group(); this.scene.add(this.ballsGroup);
    this.jack = this.sphere(.065, GOLD, .8); this.scene.add(this.jack);
    this.target = new THREE.Mesh(new THREE.RingGeometry(.13, .16, 32), new THREE.MeshBasicMaterial({ color: BLUE, side: THREE.DoubleSide })); this.target.rotation.x = -Math.PI / 2; this.scene.add(this.target);
    this.path = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: BLUE, dashSize: .11, gapSize: .09, transparent: true, opacity: .6 })); this.scene.add(this.path);
    this.measure = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: GOLD, dashSize: .035, gapSize: .025 })); this.scene.add(this.measure);
    this.resize();
  }
  material(color, fill) { const key = color + ':' + fill; if (!this.materials.has(key)) this.materials.set(key, pen(color, fill)); return this.materials.get(key); }
  sphere(r, color, fill) { const geo = new THREE.SphereGeometry(r, 20, 14), mesh = new THREE.Mesh(geo, this.material(color, fill)); const shell = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })); shell.scale.setScalar(1.035); mesh.add(shell); return mesh; }
  box(w, h, d, x, y, z, color = BLUE, fill = .03) { const geo = new THREE.BoxGeometry(w, h, d), m = new THREE.Mesh(geo, this.material(color, fill)); m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .7 }))); m.position.set(x, y, z); this.scene.add(m); return m; }
  line(points, color = BLUE, opacity = .5) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => V(...p))), new THREE.LineBasicMaterial({ color, transparent: true, opacity })); this.scene.add(l); return l; }
  buildCourt() {
    this.box(4, .13, 15, 0, -.09, 0, 0x8c7751, .05);
    for (const x of [-2.12, 2.12]) this.box(.16, .16, 15.3, x, -.015, 0);
    for (const z of [-7.62, 7.62]) this.box(4.4, .16, .16, 0, -.015, z);
    // Geometric gravel strokes on the playing surface, collected in one draw call.
    const gravel = [];
    for (let i = 0; i < 950; i++) { const x = Math.sin(i * 137.1) * 1.98, z = Math.sin(i * 93.17) * 7.45; gravel.push(x, -.015, z, x + .024, -.015, z + .009); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gravel, 3)); this.scene.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x8c7751, transparent: true, opacity: .27 })));
    const circle = new THREE.Mesh(new THREE.RingGeometry(.23, .25, 48), new THREE.MeshBasicMaterial({ color: RED, side: THREE.DoubleSide })); circle.rotation.x = -Math.PI / 2; circle.position.set(0, .008, LANE.circleZ); this.scene.add(circle);
    for (const z of [-4, 2]) {
      this.box(.65, .1, 2.1, -3, .52, z); this.box(.09, .5, 2.1, -3.3, .8, z);
      for (const dz of [-.75, .75]) this.box(.08, .5, .08, -3, .25, z + dz);
      const bag = this.sphere(.22, RED, .4); bag.position.set(-3, .79, z + .4); this.scene.add(bag);
    }
    for (const z of [-6, 1, 6]) {
      this.box(.17, 1.5, .17, 3.8, .7, z, 0x6c7390);
      const tree = this.sphere(.85, 0x6c7390, .035); tree.scale.y = 1.3; tree.position.set(3.8, 2.15, z); this.scene.add(tree);
    }
    for (let i = 0; i < 3; i++) this.box(2.8, 2.2 + i * .55, 1.4, (i - 1) * 3.1, 1 + i * .275, -10.1, 0x71798d, .01);
    this.line([[-2,.01,0],[2,.01,0]], BLUE, .08);
  }
  resize() { const rect = this.canvas.getBoundingClientRect(); this.width = rect.width; this.height = rect.height; this.renderer.setSize(rect.width, rect.height, false); const h = this.close ? 4.6 : rect.width < 550 ? 18.5 : 16; this.camera.left = -h * rect.width / rect.height / 2; this.camera.right = -this.camera.left; this.camera.top = h / 2; this.camera.bottom = -h / 2; this.camera.updateProjectionMatrix(); }
  aimAt(x, y) { const r = this.canvas.getBoundingClientRect(); this.ray.setFromCamera({ x: (x - r.left) / r.width * 2 - 1, y: 1 - (y - r.top) / r.height * 2 }, this.camera); if (!this.ray.ray.intersectPlane(this.plane, this.point)) return null; return { x: this.point.x, z: this.point.z }; }
  render(game) {
    if (this.endNumber !== game.endNumber || this.lastGame !== game) { this.ballsGroup.clear(); this.ballMeshes.clear(); this.endNumber = game.endNumber; this.lastGame = game; }
    for (const b of game.balls) {
      if (!this.ballMeshes.has(b.id)) {
        const m = this.sphere(b.r, b.team === 0 ? BLUE : RED, .23);
        for (const angle of [0, Math.PI / 2]) { const groove = new THREE.Mesh(new THREE.TorusGeometry(b.r * .995, .005, 4, 32), new THREE.MeshBasicMaterial({ color: b.team === 0 ? BLUE : RED })); groove.rotation.x = angle; m.add(groove); }
        this.ballsGroup.add(m); this.ballMeshes.set(b.id, m);
      }
      const mesh = this.ballMeshes.get(b.id); mesh.visible = !b.dead; mesh.position.set(b.x, b.y, b.z); mesh.rotation.x += b.vz * .012; mesh.rotation.z -= b.vx * .012;
    }
    this.jack.visible = !game.jack.dead; this.jack.position.set(game.jack.x, game.jack.y, game.jack.z);
    const human = game.turn === 0 && ['aim', 'jack'].includes(game.stage); this.target.visible = human; this.path.visible = human && game.stage === 'aim';
    if (human) {
      const x = Math.sin(game.heading) * game.reach, z = LANE.circleZ - Math.cos(game.heading) * game.reach;
      this.target.position.set(x, .012, z);
      const key = [game.reach, game.heading, game.mode].join(':');
      if (this.path.visible && key !== this.pathKey) { const preview = trajectory(game.reach, game.mode, game.heading); this.path.geometry.dispose(); this.path.geometry = new THREE.BufferGeometry().setFromPoints(preview.path.map(b => V(b.x, b.y, b.z))); this.path.computeLineDistances(); this.pathKey = key; }
    }
    const rank = ranking(game.balls, game.jack); this.measure.visible = rank.length > 0 && !game.jack.dead && game.stage !== 'rolling';
    if (this.measure.visible) { const b = game.balls.find(b => b.id === rank[0].id), key = [b.x,b.z,game.jack.x,game.jack.z].join(':'); if (key !== this.measureKey) { this.measureKey = key; this.measure.geometry.dispose(); this.measure.geometry = new THREE.BufferGeometry().setFromPoints([V(b.x, .03, b.z), V(game.jack.x, .03, game.jack.z)]); this.measure.computeLineDistances(); } }
    const focus = this.close ? V(game.jack.x, 0, game.jack.z) : V(0, 0, 0);
    this.camera.position.copy(focus).add(this.close ? V(0, 18, 5) : V(5, 15, 12)); this.camera.lookAt(focus); this.renderer.render(this.scene, this.camera);
  }
}
