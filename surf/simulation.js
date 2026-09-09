const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export const STEP = 1 / 120;
export class SurfGame {
  constructor() {
    this.kind='surf'; this.stage='ready'; this.x=0; this.vx=0; this.z=0; this.speed=7;
    this.time=0; this.waveTime=0; this.wave=1; this.scores=[]; this.score=0; this.energy=1;
    this.balance=1; this.air=0; this.airPower=0; this.recovery=0; this.combo=0; this.falls=0;
    this.lastTurn=0; this.carveDistance=0; this.message='Three waves. Keep the best two.';
  }
  get context() { return `${this.wave}:${this.falls}:${this.stage}`; }
  get pocket() { return Math.sin(this.time*.3)*3; }
  get total() { return [...this.scores,this.score].sort((a,b)=>b-a).slice(0,2).reduce((a,b)=>a+b,0); }
  start() { if(this.stage==='ready') {this.stage='riding';this.message='Carve through the blue pocket. Save energy for the lip.';} }
  action(power) {
    if(this.stage!=='riding'||this.recovery||this.air||this.energy<.18)return false;
    power=clamp(power,.05,1); this.energy=Math.max(0,this.energy-.12-power*.2);
    if(Math.abs(this.x)>4.3&&this.speed>7){this.air=.45+power*.6;this.airDuration=this.air;this.airPower=power;this.message='Air! Centre the steering for a clean landing.';}
    else {this.speed=Math.min(16,this.speed+1+power*3);this.message='Pump: carry speed into the next turn.';}
    return true;
  }
  wipeout() {this.falls++;this.recovery=1.7;this.combo=0;this.balance=1;this.air=0;this.speed=4;this.vx=0;this.x=0;this.message='Wipeout. Back on the board…';}
  step(dt,input={}) {
    if(this.stage!=='riding')return;
    const steer=clamp(input.steer||0,-1,1);this.time+=dt;this.waveTime+=dt;
    this.energy=clamp(this.energy+dt*.085,0,1);
    if(this.recovery){this.recovery=Math.max(0,this.recovery-dt);}
    else {
      this.vx+=(steer*6-this.vx)*(1-Math.exp(-dt*6));this.x+=this.vx*dt;
      const pocket=Math.abs(this.x-this.pocket)<2;
      this.speed=clamp(this.speed+dt*((pocket?1.2:.15)-Math.abs(steer)*.55-(input.brake?4:0)),3,16);
      this.balance=clamp(this.balance+dt*(Math.abs(steer)>.8&&this.speed>12?-.24:.2),0,1);
      this.score+=dt*(pocket?6:1)*(1+this.combo*.1);
      this.carveDistance+=Math.abs(this.vx)*dt;
      const turn=Math.abs(steer)>.35?Math.sign(steer):0;
      if(turn&&this.lastTurn&&turn!==this.lastTurn&&this.carveDistance>3&&this.speed>6&&!this.air){this.combo=Math.min(8,this.combo+1);this.score+=25+this.combo*10;this.carveDistance=0;this.message='Cutback! Flow ×'+this.combo;}
      if(turn)this.lastTurn=turn;
      if(this.air){this.air=Math.max(0,this.air-dt);if(!this.air){if(Math.abs(steer)>.65||this.balance<.25)this.wipeout();else{this.score+=60+this.airPower*100;this.message='Clean air landed!';this.combo++;}}}
      if(Math.abs(this.x)>7.4||this.balance<=0)this.wipeout();
    }
    this.z+=this.speed*dt;
    if(this.waveTime>=25){this.scores.push(Math.round(this.score));this.score=0;this.waveTime=0;if(this.wave===3){this.stage='finished';this.message='Heat complete. Best two waves: '+this.total;}else{this.wave++;this.x=0;this.vx=0;this.balance=1;this.energy=1;this.air=0;this.recovery=0;this.combo=0;this.lastTurn=0;this.carveDistance=0;this.message='Wave '+this.wave+'. Find your line.';}}
  }
}
