// Metres, based on the USA Pickleball court and traditional doubles format.
export const COURT = Object.freeze({ halfWidth: 3.048, halfLength: 6.7056, kitchen: 2.1336, netCentre: .8636, netEdge: .9144, ballRadius: .09, footRadius: .19 });
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const sideOf = z => z >= 0 ? 0 : 1;
export const signOf = team => team === 0 ? 1 : -1;
export const netHeight = x => COURT.netCentre + (COURT.netEdge - COURT.netCentre) * Math.min(1, Math.abs(x) / COURT.halfWidth);
export const insideCourt = (x, z) => Math.abs(x) <= COURT.halfWidth && Math.abs(z) <= COURT.halfLength;
export const inKitchen = player => Math.abs(player.z) - COURT.footRadius <= COURT.kitchen;
export const legalServe = (x, z, team, serverX) => insideCourt(x, z) && sideOf(z) !== team && Math.abs(z) > COURT.kitchen && x * serverX <= 0;

export class Score {
  constructor(target = 11) {
    this.target = Number(target); this.points = [0, 0]; this.team = 0;
    this.server = 0; this.serverNumber = 2; this.right = [0, 2]; this.winner = null;
  }
  get serveRight() { return this.server === this.right[this.team]; }
  get receiver() { return this.serveRight ? this.right[1 - this.team] : this.right[1 - this.team] ^ 1; }
  get call() { return `${this.points[this.team]}–${this.points[1 - this.team]}–${this.serverNumber}`; }
  award(winner) {
    if (this.winner !== null) return { match: true, winner: this.winner };
    let change = 'point';
    if (winner === this.team) {
      this.points[winner]++; this.right[winner] ^= 1;
      if (this.points[winner] >= this.target && this.points[winner] - this.points[1 - winner] >= 2) this.winner = winner;
    } else if (this.serverNumber === 1) {
      this.server ^= 1; this.serverNumber = 2; change = 'second-server';
    } else {
      this.team = 1 - this.team; this.server = this.right[this.team]; this.serverNumber = 1; change = 'side-out';
    }
    return { change, match: this.winner !== null, winner, scoring: change === 'point' };
  }
}

export class Rally {
  constructor(team, serverX, receiver) {
    this.lastTeam = team; this.serverTeam = team; this.serverX = serverX; this.receiver = receiver;
    this.serve = true; this.bounces = 0; this.mustBounce = [true, true];
  }
  fault(team, reason) { return { winner: 1 - team, reason }; }
  floor(x, z) {
    if (this.bounces > 0) return { winner: this.lastTeam, reason: 'Second bounce' };
    if (!insideCourt(x, z) || sideOf(z) === this.lastTeam) return this.fault(this.lastTeam, 'Out');
    if (this.serve && !legalServe(x, z, this.serverTeam, this.serverX)) return this.fault(this.lastTeam, 'Service fault: clear the kitchen, land diagonally');
    this.bounces++; this.mustBounce[sideOf(z)] = false;
    return null;
  }
  strike(player) {
    if (player.team === this.lastTeam) return this.fault(player.team, 'Double hit');
    if (this.serve && player.id !== this.receiver) return this.fault(player.team, 'Wrong serve receiver');
    if (this.mustBounce[player.team] && this.bounces === 0) return this.fault(player.team, 'Two-bounce rule: let it bounce');
    if (this.bounces === 0 && inKitchen(player)) return this.fault(player.team, 'Kitchen fault: no volley on or inside the line');
    this.serve = false; this.lastTeam = player.team; this.bounces = 0;
    return null;
  }
}
