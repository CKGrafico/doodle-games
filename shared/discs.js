export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function collide(a, b, restitution = .94) {
  const dx = b.x - a.x, dz = b.z - a.z, distance = Math.hypot(dx, dz), radius = a.r + b.r;
  if (distance >= radius || a.dead || b.dead) return false;
  const nx = distance > 1e-8 ? dx / distance : 1, nz = distance > 1e-8 ? dz / distance : 0;
  const overlap = (radius - distance + 1e-6) / 2;
  a.x -= nx * overlap; a.z -= nz * overlap; b.x += nx * overlap; b.z += nz * overlap;
  const approach = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
  if (approach <= 0) return false;
  const impulse = approach * (1 + restitution) / 2;
  a.vx -= impulse * nx; a.vz -= impulse * nz; b.vx += impulse * nx; b.vz += impulse * nz;
  return true;
}
export function slow(ball, friction, dt) {
  const speed = Math.hypot(ball.vx, ball.vz), scale = speed > .015 ? Math.max(0, 1 - friction * dt / speed) : 0;
  ball.vx *= scale; ball.vz *= scale;
}
export function seeded(seed = 17) {
  let value = seed >>> 0;
  return () => { value = (1664525 * value + 1013904223) >>> 0; return value / 4294967296; };
}
