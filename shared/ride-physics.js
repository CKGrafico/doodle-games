export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const damp = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt));
export const angleError = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

export function launchAir(rider, duration, power = .5) {
  rider.air = rider.airDuration = duration;
  rider.spin = 0; rider.spinTravel = 0; rider.grabTime = 0; rider.airPower = power;
}

// Release steering to straighten to the nearest full turn. A grab slows the spin.
export function stepAir(rider, dt, steer, grab) {
  if (!rider.air) return null;
  if (Math.abs(steer) > .18) {
    const rotation = steer * (grab ? 3.8 : 7.5) * dt;
    rider.spin += rotation; rider.spinTravel += Math.abs(rotation);
  } else rider.spin -= angleError(rider.spin) * (1 - Math.exp(-12 * dt));
  if (grab) rider.grabTime += dt;
  rider.air = Math.max(0, rider.air - dt);
  if (rider.air) return null;
  const clean = Math.abs(angleError(rider.spin)) < .8;
  const turns = Math.floor((Math.abs(rider.spin) + .65) / (Math.PI * 2));
  const grabbed = rider.grabTime > .15;
  return { clean, turns, grabbed, name: turns ? `${turns * 360}${grabbed ? ' grab' : ''}` : grabbed ? 'Grab' : 'Straight air' };
}

export function crossed(oldZ, z, target, oldX, x, width) {
  if (oldZ >= target.z || z < target.z) return false;
  const t = (target.z - oldZ) / (z - oldZ);
  return Math.abs(oldX + (x - oldX) * t - target.x) <= width;
}
