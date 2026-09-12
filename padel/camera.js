import * as THREE from '../vendor/three.module.min.js';

// Fit the court, glass and athletes in the usable canvas, including portrait.
export function courtCameraPose(aspect, fov = 39, raised = true) {
  const direction = new THREE.Vector3(raised ? 13.5 : 0, raised ? 21 : 17, 27).normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right);
  const tanY = Math.tan(fov * Math.PI / 360) * .88;
  const tanX = tanY * Math.max(.1, aspect);
  let distance = 0;
  const center = new THREE.Vector3(0, 1, 0);
  for (const x of [-5.5, 5.5]) for (const y of [0, 4]) for (const z of [-10.5, 10.5]) {
    const point = new THREE.Vector3(x, y, z).sub(center);
    distance = Math.max(distance, point.dot(direction) + Math.max(Math.abs(point.dot(right)) / tanX, Math.abs(point.dot(up)) / tanY));
  }
  return { eye: direction.multiplyScalar(distance).add(center), center };
}

// Ease an explicit partner switch for 180 ms, while preserving mouse yaw.
// Ordinary movement already comes from the interpolated simulation snapshot.
export class PlayerEye {
  constructor() { this.eye = [0, 1.65, 0]; this.from = [...this.eye]; this.elapsed = .18; }
  update(state, dt, reducedMotion = false) {
    const player = state.players[state.controlled], target = [player.x, 1.65, player.z];
    if (this.revision !== state.poseVersion) { this.elapsed = .18; this.eye = target; }
    else if (this.controlled !== state.controlled) { this.from = [...this.eye]; this.elapsed = 0; }
    this.revision = state.poseVersion; this.controlled = state.controlled;
    this.elapsed = Math.min(.18, this.elapsed + dt);
    const t = reducedMotion ? 1 : this.elapsed / .18, ease = t * t * (3 - 2 * t);
    this.eye = ease === 1 ? target : target.map((value, i) => this.from[i] + (value - this.from[i]) * ease);
    return this.eye;
  }
}
