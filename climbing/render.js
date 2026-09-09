import * as THREE from '../vendor/three.module.min.js';
import { penMaterial, inkSurface, outlineMeshes } from '../shared/ink.js';
import { HOLDS, WALL } from './simulation.js';
const BLUE = 0x2a42ad, RED = 0xc94b59, PAPER = 0xf7f4e9, GREY = 0x6d7487;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class ClimbingView {
  constructor(canvas) {
    this.canvas = canvas; this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); this.renderer.setClearColor(PAPER, 0);
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
    this.ray = new THREE.Raycaster(); this.wallPlane = new THREE.Plane(V(0, 0, 1), 0); this.point = V();
    this.lobby = true; this.build(); this.people = [this.climber(BLUE), this.climber(RED)];
    this.target = new THREE.Mesh(new THREE.RingGeometry(.23, .31, 32), new THREE.MeshBasicMaterial({ color: RED, side: THREE.DoubleSide }));
    this.target.position.z = .11; this.scene.add(this.target); this.resize();
  }
  box(w, h, d, x, y, z, color = BLUE, fill = .08) {
    const geometry = new THREE.BoxGeometry(w, h, d), mesh = new THREE.Mesh(geometry, penMaterial(color, fill)); mesh.position.set(x, y, z);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color }))); this.scene.add(mesh); return mesh;
  }
  build() {
    this.box(10.8, 16.5, .26, 0, 7.6, 0, GREY, .012);
    this.box(.17, 16.2, .12, 0, 7.6, .2, BLUE, .55);
    this.box(11.5, .35, 2.4, 0, -.25, .8, BLUE, .12);
    for (const lane of [-2.55, 2.55]) {
      this.box(4.45, .045, .08, lane, 15.2, .21, RED, .8);
      const pad = new THREE.Mesh(new THREE.CircleGeometry(.28, 30), inkSurface(RED, .8)); pad.position.set(lane, 15.05, .17); this.scene.add(pad);
      for (const hold of HOLDS) {
        const geometry = new THREE.DodecahedronGeometry(hold.index % 3 === 0 ? .23 : .18, 0), mesh = new THREE.Mesh(geometry, penMaterial(hold.index % 4 === 0 ? BLUE : RED, .58));
        mesh.scale.set(1.45, .72, .55); mesh.rotation.z = hold.index * .91; mesh.position.set(lane + hold.x, hold.y, .22);
        mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: hold.index % 4 === 0 ? BLUE : RED }))); this.scene.add(mesh);
      }
      this.box(.9, .08, .65, lane, .02, .6, RED, .4);
      const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(lane, 15.8, .6), V(lane, .5, .6)]), new THREE.LineDashedMaterial({ color: BLUE, dashSize: .2, gapSize: .12, transparent: true, opacity: .45 })); rope.computeLineDistances(); this.scene.add(rope);
    }
    for (let x = -8; x <= 8; x += 4) { this.box(.12, 4, .12, x, 1.6, -1.6, GREY, .08); this.box(3.2, .16, .16, x, 3.5, -1.6, GREY, .08); }
  }
  limb(length, color) { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.055, .08, length, 7), penMaterial(color, .32)); mesh.geometry.translate(0, -length / 2, 0); return mesh; }
  climber(color) {
    const group = new THREE.Group(), body = new THREE.Mesh(new THREE.CapsuleGeometry(.18, .42, 4, 8), penMaterial(color, .45)); body.position.y = .15; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.15, 12, 8), penMaterial(PAPER, .08)); head.position.y = .58; group.add(head);
    const limbs = [];
    for (const [x, y, length] of [[-.18,.36,.48],[.18,.36,.48],[-.13,-.05,.55],[.13,-.05,.55]]) { const limb = this.limb(length, color); limb.position.set(x, y, 0); group.add(limb); limbs.push(limb); }
    group.userData = { body, limbs }; outlineMeshes(group, color); group.position.z = .62; this.scene.add(group); return group;
  }
  resize() { const rect = this.canvas.getBoundingClientRect(); this.width = rect.width; this.height = rect.height; this.renderer.setSize(rect.width, rect.height, false); this.camera.aspect = rect.width / rect.height; this.camera.updateProjectionMatrix(); }
  setLobby(value) { this.lobby = value; }
  aimAt(x, y) {
    const rect = this.canvas.getBoundingClientRect(); this.ray.setFromCamera({ x: (x - rect.left) / rect.width * 2 - 1, y: 1 - (y - rect.top) / rect.height * 2 }, this.camera);
    if (!this.ray.ray.intersectPlane(this.wallPlane, this.point)) return null; return { x: this.point.x, y: this.point.y };
  }
  render(game, dt = 0, time = 0) {
    const focusY = this.lobby ? 7.3 : Math.max(6.4, Math.min(10.5, game.player.y + 3));
    const desired = this.lobby ? V(12.5, 8.3, 24) : V(10.5, focusY + .5, 22);
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 4)); this.camera.lookAt(0, focusY, 0);
    for (const climber of game.climbers) {
      const mesh = this.people[climber.lane], laneX = climber.lane ? 2.55 : -2.55;
      mesh.position.set(laneX + climber.x, climber.y, .62); mesh.userData.body.rotation.z = Math.sin(time * 9 + climber.lane) * .08;
      const next = HOLDS[Math.min(climber.hold + 1, HOLDS.length - 1)], direction = Math.sign(next.x - climber.x || 1);
      mesh.userData.limbs[0].rotation.z = -.3 - direction * .45; mesh.userData.limbs[1].rotation.z = .3 - direction * .45;
      mesh.userData.limbs[2].rotation.z = -.22 + direction * .25; mesh.userData.limbs[3].rotation.z = .22 + direction * .25;
    }
    const target = HOLDS[game.target]; this.target.visible = !this.lobby && game.stage === 'racing' && !!target;
    if (target) { this.target.position.set(-2.55 + target.x, target.y, .3); this.target.rotation.z = time; }
    this.renderer.render(this.scene, this.camera);
  }
}
