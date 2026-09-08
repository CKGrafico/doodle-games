// Pure rules and scoring. One scene unit is one metre.
export const COURT = Object.freeze({ halfWidth: 5, halfLength: 10, serviceLine: 6.95, netCentre: 0.88, netEdge: 0.92, glass: 3, backHeight: 4, sideHeight: 3, ballRadius: 0.105 });
export const sideOf = z => z >= 0 ? 0 : 1;
export const signOf = team => team === 0 ? 1 : -1;
export const netHeight = x => COURT.netCentre + Math.abs(x) / COURT.halfWidth * (COURT.netEdge - COURT.netCentre);
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export function wallKind(axis, y, z) {
  if (axis === 'z') return y <= 3 ? 'glass' : 'fence';
  return Math.abs(z) >= 6 && y <= 3 ? 'glass' : 'fence';
}
export function serviceBoxValid(x, z, servingTeam, serveX) {
  return sideOf(z) !== servingTeam && Math.abs(z) <= COURT.serviceLine + 0.025 && Math.abs(x) <= 5.025 && x * serveX <= 0;
}

export class Score {
  constructor(mode = 'quick') {
    this.mode = mode;
    this.points = [0, 0]; this.games = [0, 0]; this.totalPoints = 0;
    this.gameNumber = 0; this.tiebreak = false; this.winner = null;
    this.tiebreakStart = 0;
  }
  get serverSlot() {
    if (!this.tiebreak) return this.gameNumber % 4;
    const n = this.points[0] + this.points[1];
    return (this.tiebreakStart + (n === 0 ? 0 : 1 + Math.floor((n - 1) / 2))) % 4;
  }
  get server() { return [0, 2, 1, 3][this.serverSlot]; }
  get serveRight() { return (this.points[0] + this.points[1]) % 2 === 0; }
  labels() {
    if (this.tiebreak) return this.points.map(String);
    const [a,b] = this.points;
    if (a >= 3 && b >= 3 && a !== b) return a > b ? ['AD','40'] : ['40','AD'];
    return this.points.map(n => ['0','15','30','40'][Math.min(n,3)]);
  }
  get decidingPoint() { return !this.tiebreak && this.mode === 'quick' && this.points.every(n => n === 3); }
  award(team) {
    if (this.winner !== null) return { match: true, winner: this.winner };
    this.totalPoints++; this.points[team]++;
    if (this.mode === 'practice') return { game:false, match:false };
    const other = 1-team;
    const needed = this.tiebreak ? 7 : 4;
    const margin = !this.tiebreak && this.mode === 'quick' ? 1 : 2;
    if (this.points[team] < needed || this.points[team] - this.points[other] < margin) return {game:false,match:false};
    this.games[team]++; this.gameNumber++;
    const wasTiebreak = this.tiebreak;
    this.points = [0,0];
    const won = wasTiebreak || (this.mode === 'quick' ? this.games[team] === 3 : this.games[team] >= 6 && this.games[team]-this.games[other] >= 2);
    if(won) this.winner = team;
    else if(this.mode === 'set' && this.games.every(n=>n===6)) {this.tiebreak=true; this.tiebreakStart=this.gameNumber%4;}
    return {game:true,match:won,winner:won?team:null};
  }
}

// A rally records the last striking team and bounces since that stroke.
// Result objects describe events without changing the score twice.
export class Rally {
  constructor(team, serveX, receiver) {
    this.lastTeam=team; this.bounces=0; this.isServe=true;
    this.serveX=serveX; this.receiver=receiver; this.netTouched=false;
  }
  strike(team, player) {
    if(team===this.lastTeam) return {winner:1-team,reason:'Double hit'};
    if(this.isServe && (this.bounces===0 || player!==this.receiver)) return {winner:this.lastTeam,reason:this.bounces===0?'Serve must bounce':'Wrong receiver'};
    if(this.isServe && this.netTouched) return {let:true,reason:'Let. Serve again'};
    this.lastTeam=team; this.bounces=0; this.isServe=false; this.netTouched=false;
    return null;
  }
  floor(x,z) {
    const team=sideOf(z);
    if(this.bounces===0) {
      if(team===this.lastTeam) return this.isServe?{fault:true,reason:'Serve into the net'}:{winner:1-this.lastTeam,reason:'Ball bounced on own side'};
      if(this.isServe && !serviceBoxValid(x,z,this.lastTeam,this.serveX)) return {fault:true,reason:'Serve outside the box'};
      this.bounces=1;
      return null;
    }
    if(this.isServe && this.netTouched) return {let:true,reason:'Let. Serve again'};
    return {winner:this.lastTeam,reason:'Second bounce'};
  }
  wall(kind,team) {
    if(this.isServe && this.bounces===0) return {fault:true,reason:'Serve hit the wall first'};
    if(this.isServe && kind==='fence') return {fault:true,reason:'Serve hit the fence'};
    if(this.bounces===0 && (team!==this.lastTeam || kind==='fence')) return {winner:1-this.lastTeam,reason:'Wall before the bounce'};
    return null;
  }
  out() {
    if(this.isServe) return {fault:true,reason:'Serve out'};
    return {winner:this.bounces>0?this.lastTeam:1-this.lastTeam,reason:this.bounces>0?'Out of the cage!':'Out before the bounce'};
  }
}
