import * as THREE from '../vendor/three.module.min.js';

// Only call once, before adding animated players, balls and markers.
export function batchStaticInk(scene) {
  scene.updateMatrixWorld(true);
  const lineGroups = new Map(), barGroups = new Map();
  scene.traverse(object => {
    const groups = object.isLine ? lineGroups : object.userData.staticBar ? barGroups : null;
    if (!groups) return;
    const list = groups.get(object.material) ?? [];
    list.push(object); groups.set(object.material, list);
  });
  let before = 0, after = 0;
  for (const [material, lines] of lineGroups) {
    before += lines.length; after++;
    const points = [], point = new THREE.Vector3();
    for (const line of lines) {
      const positions = line.geometry.attributes.position, indices = line.geometry.index;
      const count = indices?.count ?? positions.count, step = line.isLineSegments ? 2 : 1;
      for (let i = 0; i + 1 < count; i += step) for (const vertex of [i, i + 1]) {
        point.fromBufferAttribute(positions, indices ? indices.getX(vertex) : vertex).applyMatrix4(line.matrixWorld);
        points.push(point.x, point.y, point.z);
      }
      line.removeFromParent(); line.geometry.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.computeBoundingSphere(); scene.add(new THREE.LineSegments(geometry, material));
  }
  for (const [material, bars] of barGroups) {
    before += bars.length; after++;
    const batch = new THREE.InstancedMesh(bars[0].geometry, material, bars.length);
    bars.forEach((bar, i) => { batch.setMatrixAt(i, bar.matrixWorld); bar.removeFromParent(); });
    batch.instanceMatrix.needsUpdate = true; batch.computeBoundingSphere(); scene.add(batch);
  }
  return { before, after };
}
