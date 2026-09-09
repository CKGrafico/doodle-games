export const STEP = 1 / 120;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const length = (a, b) => Math.hypot(a.x-b.x, a.z-b.z);
const fence = (z, gap, width) => [{x:-15,z,w:gap-width/2+15,d:.5},{x:gap+width/2,z,w:15-gap-width/2,d:.5}];
export const LEVELS = [
  {name:'First flock',count:8,quota:6,seconds:150,par:80,tip:'Circle behind the flock. Gentle pressure guides them through the gap.',fences:fence(2,0,8),river:false,tractor:false},
  {name:'Bridge bother',count:10,quota:8,seconds:180,par:110,tip:'Calm sheep follow your whistle. Lead small groups across the blue bridge.',fences:[],river:true,tractor:false},
  {name:'Market mayhem',count:12,quota:9,seconds:210,par:140,tip:'Take the left gap, then the right. Open the gate by its switch. Watch the tractor!',fences:[...fence(5,-5,7),...fence(-5,5,7)],river:false,tractor:true},
];
const rectContains = (p,r,pad=0) => p.x>r.x-pad&&p.x<r.x+r.w+pad&&p.z>r.z-pad&&p.z<r.z+r.d+pad;
export class SheepGame {
  constructor({level=0,seed=17,relaxed=false}={}) {
    this.kind='sheep';this.level=clamp(Number(level)||0,0,2);this.config=LEVELS[this.level];this.seed=seed>>>0||17;this.relaxed=relaxed;
    this.stage='ready';this.time=0;this.saved=0;this.lost=0;this.events=[];this.message=this.config.tip;
    this.player={x:0,z:17,vx:0,vz:0,angle:0};this.controlled=0;this.players=[this.player];this.aim={x:0,z:0};
    this.whistleTime=0;this.whistleCooldown=0;this.barkCooldown=0;this.barkRing=0;this.barkPower=0;this.gateOpen=false;
    this.lever={x:9,z:-2};this.pen={x:-4,z:-19,w:8,d:5};this.tractor={x:-11,z:-9,r:1.1};
    this.sheep=Array.from({length:this.config.count},(_,id)=>({id,x:(id%4-1.5)*1.5,z:10+Math.floor(id/4)*1.6,vx:0,vz:0,angle:0,fear:0,follow:0,saved:false,lost:false,breed:id%3,phase:this.random()*6.28}));
  }
  random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;}
  get context(){return this.level+':'+this.stage;}
  get remaining(){return this.config.count-this.saved-this.lost;}
  get stars(){return this.stage!=='won'?0:1+Number(this.saved===this.config.count)+Number(this.lost===0&&(this.relaxed||this.time<=this.config.par));}
  get obstacles(){return this.config.fences.concat(this.level===2&&!this.gateOpen?[{x:1.5,z:-5,w:7,d:.5}]:[]);}
  emit(text,type='hint'){this.message=text;this.events.push({text,type});}
  drainEvents(){return this.events.splice(0);}
  start(){if(this.stage==='ready'){this.stage='playing';this.emit(this.config.tip);}}
  openGate(){
    if(this.stage!=='playing'||this.level!==2||length(this.player,this.lever)>3)return false;
    if(this.gateOpen&&this.sheep.some(s=>!s.saved&&!s.lost&&rectContains(s,{x:1.5,z:-5,w:7,d:.5},.5))){this.emit('Wait until the sheep are clear before closing the gate.');return false;}
    this.gateOpen=!this.gateOpen;this.emit(this.gateOpen?'Gate open. Bring the flock through.':'Gate closed.','gate');return true;
  }
  whistle(){
    if(this.stage!=='playing'||this.whistleCooldown>0)return false;
    this.whistleTime=3.5;this.whistleCooldown=5;let heard=0;
    for(const s of this.sheep)if(!s.saved&&!s.lost&&length(s,this.player)<9&&this.lineClear(this.player,s)){s.fear=Math.max(0,s.fear-.8);s.follow=6;heard++;}
    this.emit(heard?'Whistle! '+heard+' sheep are following.':'Come closer: whistle reaches nine metres.','whistle');return true;
  }
  bark(power=.5){
    if(this.stage!=='playing'||this.barkCooldown>0)return false;
    power=clamp(power,.05,1);this.barkCooldown=.65;this.barkRing=.5;this.barkPower=power;
    let dx=this.aim.x-this.player.x,dz=this.aim.z-this.player.z,n=Math.hypot(dx,dz)||1;dx/=n;dz/=n;
    let heard=0;
    for(const s of this.sheep){
      if(s.saved||s.lost)continue;
      const sx=s.x-this.player.x,sz=s.z-this.player.z,d=Math.hypot(sx,sz)||.01;
      if(d<3+power*6&&(sx*dx+sz*dz)/d>-.15&&this.lineClear(this.player,s)){
        s.vx+=sx/d*(1+power*3);s.vz+=sz/d*(1+power*3);s.fear=clamp(s.fear+power*.65,0,1);s.follow=0;heard++;
      }
    }
    this.emit(heard?(power>.75?'Big bark! Watch their panic.':'Easy does it. Guide, do not scatter.'):'Aim the bark toward nearby sheep.','bark');return true;
  }
  lineClear(a,b){
    const steps=Math.ceil(length(a,b)/.2);
    for(let i=1;i<steps;i++){const p={x:a.x+(b.x-a.x)*i/steps,z:a.z+(b.z-a.z)*i/steps};if(this.obstacles.some(r=>rectContains(p,r)))return false;}
    return true;
  }
  blocked(p,r=.4){return Math.abs(p.x)>14.5-r||Math.abs(p.z)>19.5-r||this.obstacles.some(o=>rectContains(p,o,r))||this.config.river&&Math.abs(p.z)<2+r&&Math.abs(p.x)>3.3-r;}
  move(body,dt,r=.4){
    // Axis separation lets the flock slide along fences instead of sticking at corners.
    const next={x:body.x+body.vx*dt,z:body.z};if(!this.blocked(next,r))body.x=next.x;else body.vx*=.2;
    next.x=body.x;next.z=body.z+body.vz*dt;if(!this.blocked(next,r))body.z=next.z;else body.vz*=.2;
  }
  finish(){if(this.stage==='playing'&&this.saved>=this.config.quota){this.stage='won';this.emit('Flock home! '+this.saved+' rescued.','win');return true;}return false;}
  step(dt,input={}){
    if(this.stage!=='playing')return;
    dt=clamp(dt,0,.05);this.time+=dt;
    for(const key of ['whistleTime','whistleCooldown','barkCooldown','barkRing'])this[key]=Math.max(0,this[key]-dt);
    const p=this.player;let mx=input.moveX||0,mz=input.moveZ||0;const n=Math.max(1,Math.hypot(mx,mz));mx/=n;mz/=n;
    const speed=input.sprint?7:4.5,t=1-Math.exp(-12*dt);p.vx+=(mx*speed-p.vx)*t;p.vz+=(mz*speed-p.vz)*t;this.move(p,dt,.35);
    if(Math.hypot(p.vx,p.vz)>.1)p.angle=Math.atan2(p.vx,-p.vz);
    if(input.aim&&Number.isFinite(input.aim.x)&&Number.isFinite(input.aim.z))this.aim={...input.aim};
    if(input.whistle)this.whistle();if(input.gate)this.openGate();if(input.bark!==undefined)this.bark(input.bark);
    this.tractor.x=Math.sin(this.time*.65)*11;
    const snapshots=this.sheep.map(s=>({...s}));
    for(const s of this.sheep){
      if(s.saved||s.lost)continue;
      s.fear=Math.max(0,s.fear-dt*.14);s.follow=Math.max(0,s.follow-dt);
      let ax=0,az=0,cx=0,cz=0,neighbours=0;
      for(const other of snapshots){
        if(other.id===s.id||other.saved||other.lost)continue;
        const d=length(s,other);
        if(d<4.5&&this.lineClear(s,other)){cx+=other.x;cz+=other.z;neighbours++;}
        if(d<1.15&&d>.001){ax+=(s.x-other.x)/d*(1.15-d)*9;az+=(s.z-other.z)/d*(1.15-d)*9;}
      }
      if(neighbours){ax+=(cx/neighbours-s.x)*.45;az+=(cz/neighbours-s.z)*.45;}
      const d=length(s,p),heard=this.lineClear(s,p);
      if(s.follow>0&&heard){if(d>1.8){ax+=(p.x-s.x)/Math.max(d,.1)*5;az+=(p.z-s.z)/Math.max(d,.1)*5;}}
      else if(d<4.5&&heard){const pressure=(4.5-d)*(s.breed===1?.8:1.1);ax+=(s.x-p.x)/Math.max(.1,d)*pressure*3;az+=(s.z-p.z)/Math.max(.1,d)*pressure*3;if(input.sprint&&d<2)s.fear=clamp(s.fear+dt*.5,0,1);}
      else {ax+=Math.sin(this.time*.6+s.phase)*.22;az+=Math.cos(this.time*.7+s.phase)*.22;}
      // Panicked sheep scatter, calm sheep cohere. No global force pulls them to the pen.
      ax+=Math.sin(this.time*4+s.phase)*s.fear*2;az+=Math.cos(this.time*3+s.phase)*s.fear*2;
      if(this.config.tractor){const td=length(s,this.tractor);if(td<4){ax+=(s.x-this.tractor.x)/Math.max(.1,td)*4;az+=(s.z-this.tractor.z)/Math.max(.1,td)*4;}
        if(td<1.35){s.lost=true;this.lost++;this.emit('One sheep bolted back to the barn. Watch the tractor.','lost');continue;}}
      const friction=Math.exp(-2.2*dt);s.vx=(s.vx+ax*dt)*friction;s.vz=(s.vz+az*dt)*friction;
      const maxSpeed=(s.breed===1?2.6:3.2)+s.fear*1.4,v=Math.hypot(s.vx,s.vz);if(v>maxSpeed){s.vx*=maxSpeed/v;s.vz*=maxSpeed/v;}
      this.move(s,dt,.38);if(Math.hypot(s.vx,s.vz)>.08)s.angle=Math.atan2(s.vx,-s.vz);
      if(rectContains(s,this.pen,-.15)){s.saved=true;s.vx=s.vz=0;this.saved++;this.emit(this.saved+' / '+this.config.count+' safely home!','save');}
    }
    if(this.saved===this.config.count){this.finish();return;}
    if(this.saved+this.remaining<this.config.quota){this.stage='lost';this.emit('Not enough sheep left. Try a calmer route.','lost');}
    else if(!this.relaxed&&this.time>=this.config.seconds){if(!this.finish()){this.stage='lost';this.emit('Time up. Retry, or practise without the clock.','lost');}}
  }
}
