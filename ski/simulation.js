const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const STEP=1/120;
export class SkiGame {
  constructor(){
    this.kind='ski';this.stage='ready';this.x=0;this.vx=0;this.z=0;this.speed=8;this.time=0;this.energy=1;
    this.balance=1;this.air=0;this.recovery=0;this.falls=0;this.passed=0;this.missed=0;this.penalty=0;this.nextGate=0;
    this.gates=Array.from({length:20},(_,i)=>({z:40+i*40,x:Math.sin(i*.95)*4,done:false,hit:false}));
    this.rocks=[{x:-6,z:145},{x:5.8,z:270},{x:-5.8,z:390},{x:6,z:530},{x:-6,z:675}];
    this.message='Twenty gates. Every missed gate adds three seconds.';
  }
  get context(){return `${this.stage}:${this.falls}`;}
  get total(){return this.time+this.penalty;}
  start(){if(this.stage==='ready'){this.stage='riding';this.message='Turn early. Brake to tighten your line.';}}
  action(power){if(this.stage!=='riding'||this.air||this.recovery||this.energy<.2)return false;power=clamp(power,.05,1);this.energy=Math.max(0,this.energy-.18-power*.2);this.air=.3+power*.65;this.airDuration=this.air;this.message='Hop! Centre the steering before landing.';return true;}
  crash(){this.falls++;this.penalty+=2;this.recovery=1.2;this.speed=4;this.balance=1;this.vx=0;this.x=clamp(this.x,-6.5,6.5);this.air=0;this.message='Fall: +2 seconds. Recovering…';}
  step(dt,input={}){
    if(this.stage!=='riding')return;this.time+=dt;this.energy=clamp(this.energy+dt*.1,0,1);
    if(this.recovery){this.recovery=Math.max(0,this.recovery-dt);return;}
    const oldZ=this.z,oldX=this.x,steer=clamp(input.steer||0,-1,1),brake=!!input.brake;
    this.speed=clamp(this.speed+dt*(3.2-Math.abs(steer)*1.8-(brake?10:0)),4,24);
    this.vx+=(steer*(brake?7:9)-this.vx)*(1-Math.exp(-dt*(this.air?1.5:7)));
    this.x+=this.vx*dt;this.z+=this.speed*dt;
    this.balance=clamp(this.balance+dt*(this.speed>20&&Math.abs(steer)>.85?-.3:.25),0,1);
    if(this.air){this.air=Math.max(0,this.air-dt);if(!this.air&&Math.abs(steer)>.7){this.crash();}}
    for(const rock of this.rocks)if(oldZ<rock.z&&this.z>=rock.z&&this.air===0){const t=(rock.z-oldZ)/(this.z-oldZ),x=oldX+(this.x-oldX)*t;if(Math.abs(x-rock.x)<1)this.crash();}
    while(this.nextGate<this.gates.length&&this.z>=this.gates[this.nextGate].z){
      const gate=this.gates[this.nextGate++],t=clamp((gate.z-oldZ)/(this.z-oldZ),0,1),x=oldX+(this.x-oldX)*t;
      gate.done=true;gate.hit=Math.abs(x-gate.x)<=2;
      if(gate.hit){this.passed++;this.message='Gate '+this.nextGate+' cleared.';}else{this.missed++;this.penalty+=3;this.message='Missed gate: +3 seconds.';}
    }
    if(Math.abs(this.x)>8||this.balance<=0)this.crash();
    if(this.z>=850){this.z=850;this.stage='finished';this.message=`Finish! ${this.passed}/20 gates · ${this.total.toFixed(2)} s with penalties.`;}
  }
}
