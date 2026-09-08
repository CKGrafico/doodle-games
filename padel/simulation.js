import { COURT, Score, Rally, clamp, sideOf, signOf, netHeight, wallKind } from './rules.js';

export const GRAVITY = 9.81;
export const FIXED_STEP = 1 / 120;
const R = COURT.ballRadius;
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export function randomGenerator(seed=4187) {
  return () => {seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t=Math.imul(seed ^ seed >>> 15, 1 | seed); t=t+Math.imul(t ^ t >>> 7,61 | t)^t; return ((t ^ t>>>14)>>>0)/4294967296;};
}

export class PadelGame {
  constructor({mode='quick', difficulty='club', assisted=true, seed=4187}={}) {
    this.random=randomGenerator(seed); this.mode=mode; this.difficulty=difficulty; this.assisted=assisted;
    this.score=new Score(mode); this.time=0; this.stage='ready'; this.timer=0;
    this.controlled=0; this.switchLock=0; this.serveAttempt=1; this.events=[];
    this.players=Array.from({length:4},(_,id)=>({id,team:Math.floor(id/2),x:0,z:0,vx:0,vz:0,swing:0,cooldown:0,readX:0,readZ:0}));
    this.ball={x:0,y:0.8,z:0,vx:0,vy:0,vz:0};
    this.rally=null; this.rallyHits=0; this.bestRally=0; this.wallReturns=0;
    this.message='Your serve'; this.aim={x:-2,z:-7.5}; this.lastHitTime=-10;
    this.lastWallTime=-10; this.prepareServe();
  }
  emit(type,data={}) {this.events.push({type,...data});}
  drainEvents() {return this.events.splice(0);}
  prepareServe() {
    const server=this.score.server, team=Math.floor(server/2), s=signOf(team);
    const sx=(this.score.serveRight?1:-1)*s*2.55;
    this.players.forEach((p,i)=>{p.x=(i%2===0?-2.5:2.5);p.z=signOf(p.team)*7.5;p.swing=0;p.vx=0;p.vz=0;});
    const p=this.players[server];p.x=sx;p.z=s*8.25;
    const partner=this.players[server^1];partner.x=-sx;partner.z=s*3.6;
    const candidates=this.players.filter(p=>p.team!==team);
    this.receiver=candidates.find(p=>p.x*sx<0).id;
    if(team===0)this.controlled=server;else this.controlled=this.receiver;
    Object.assign(this.ball,{x:p.x+0.35,y:0.8,z:p.z-s*0.35,vx:0,vy:0,vz:0});
    this.stage='ready';this.timer=0;this.rallyHits=0;this.rally=null;this.servedBounce=false;
    this.message=team===0?(this.serveAttempt===2?'Second serve':'Your serve'):'District serves';
    this.emit('ready');
  }
  startServe() {if(this.stage!=='ready')return;this.stage='serve-bounce';this.ball.vy=0;this.timer=0;}
  launchServe() {
    const p=this.players[this.score.server], s=signOf(p.team);
    this.rally=new Rally(p.team,p.x,this.receiver);
    const target={x:-Math.sign(p.x)*(1.7+this.random()*1.15),z:-s*5.3};
    this.launch(target,'serve');p.swing=0.42;this.stage='rally';this.rallyHits=1;
    this.message='Rally on';this.emit('hit',{kind:'serve',player:p.id});
  }
  launch(target,kind,power=.65) {
    const b=this.ball, dx=target.x-b.x, dz=target.z-b.z;
    const d=Math.hypot(dx,dz);
    let flight=kind==='lob'?2.5:kind==='smash'?clamp(d/17,0.52,1.4):kind==='serve'?1.32:clamp(d/11.5,0.8,1.85);
    if(kind!=='serve')flight/=.7+clamp(power,0,1)*(.3/.65);
    let vy=(R-b.y+0.5*GRAVITY*flight*flight)/flight;
    const fraction=-b.z/dz;
    // Aim assistance chooses an arc that clears the net, while shot choice
    // still controls pace, height, depth, and the rebound off the glass.
    if(fraction>0 && fraction<1) {
      for(let i=0;i<30;i++) {
        const t=flight*fraction, h=b.y+vy*t-0.5*GRAVITY*t*t;
        if(h>netHeight(b.x+dx*fraction)+R+0.13)break;
        flight+=0.035;vy=(R-b.y+0.5*GRAVITY*flight*flight)/flight;
      }
    }
    b.vx=dx/flight;b.vz=dz/flight;b.vy=vy;this.lastHitTime=this.time;this.designatedChaser=null;
    // One imperfect read per stroke, never a random miss rolled every frame.
    // Error changes the AI's movement, so the ball remains governed by physics.
    for(const p of this.players) {
      const chance=p.team===0?.06:{casual:.3,club:.19,pro:.1}[this.difficulty];
      const error=this.random()<chance?4.2:.32;
      p.readX=(this.random()-.5)*error*2;p.readZ=(this.random()-.5)*error;
    }
  }
  resolve(result) {
    if(!result||this.stage!=='rally')return false;
    if(result.let || result.fault) {
      if(result.fault && this.serveAttempt===2) return this.resolve({winner:1-Math.floor(this.score.server/2),reason:'Double fault'});
      if(result.fault)this.serveAttempt=2;
      this.stage='between';this.timer=1.8;this.message=result.reason;
      this.ball.vx=this.ball.vy=this.ball.vz=0;this.emit(result.let?'let':'fault',{reason:result.reason});return true;
    }
    if(result.winner===undefined)return false;
    this.bestRally=Math.max(this.bestRally,this.rallyHits);
    const scored=this.score.award(result.winner);
    this.serveAttempt=1;
    this.stage=scored.match?'over':'between';this.timer=2.2;
    this.message=scored.match?(result.winner===0?'The district is yours!':'The district wins'):result.reason;
    this.ball.vx=this.ball.vy=this.ball.vz=0;
    this.emit('point',{...result,...scored});return true;
  }
  predict() {
    const b={...this.ball};let bounces=this.rally?.bounces??0;
    for(let t=0;t<2.8;t+=0.035) {
      b.vy-=GRAVITY*0.035;b.x+=b.vx*0.035;b.y+=b.vy*0.035;b.z+=b.vz*0.035;
      if(Math.abs(b.x)>5-R){b.x=clamp(b.x,-5+R,5-R);b.vx*=-0.82;}
      if(Math.abs(b.z)>10-R){b.z=clamp(b.z,-10+R,10-R);b.vz*=-0.82;}
      if(b.y<R){b.y=R;b.vy=Math.abs(b.vy)*0.73;bounces++;}
      if((bounces>0 && b.y>0.65 && b.y<1.55) || (b.y<1.7 && b.vy<0 && t>0.12 && !this.rally?.isServe))return b;
      if(bounces>=2)break;
    }
    return b;
  }
  movePlayer(p,target,speed,dt) {
    let dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);
    const step=Math.min(d,speed*dt);
    const oldX=p.x,oldZ=p.z;
    if(d>0.03){p.x+=dx/d*step;p.z+=dz/d*step;}
    p.x=clamp(p.x,-4.58,4.58);
    p.z=p.team===0?clamp(p.z,0.6,9.55):clamp(p.z,-9.55,-0.6);
    p.vx=(p.x-oldX)/dt;p.vz=(p.z-oldZ)/dt;
  }
  hit(p,kind='drive',aim,power=.65) {
    if(this.stage!=='rally' || this.time-this.lastHitTime<0.17 || p.cooldown>0)return false;
    const b=this.ball;
    if(!this.rally || p.team===this.rally.lastTeam || sideOf(b.z)!==p.team)return false;
    if(this.rally.isServe && (this.rally.bounces===0 || p.id!==this.receiver))return false;
    const reach=p.id===this.controlled?1.65:1.35;
    const maxHeight=p.id===this.controlled?(kind==='smash'?3.1:2.25):2.05;
    if(distance(p,b)>reach || b.y<0.23 || b.y>maxHeight)return false;
    const result=this.rally.strike(p.team,p.id);if(this.resolve(result))return false;
    const opponent=1-p.team,s=signOf(opponent);
    let target;
    if(aim && p.team===0) {
      target={x:clamp(aim.x,-4.4,4.4),z:-clamp(Math.abs(aim.z),2.2,9.0)};
    } else {
      const candidates=this.players.filter(q=>q.team===opponent);
      const avgX=(candidates[0].x+candidates[1].x)/2;
      target={x:clamp(-avgX+(this.random()-0.5)*6.6,-4.1,4.1),z:s*(6.2+this.random()*2.4)};
      kind=this.random()<0.18?'lob':'drive';
    }
    if(kind==='smash' && b.y<1.65)kind='drive';
    if(kind==='lob')target.z=s*8.35;
    if(kind==='smash')target.z=s*6.5;
    this.launch(target,kind,power);p.swing=0.4;p.cooldown=0.44;this.rallyHits++;
    if(this.time-this.lastWallTime<2 && this.lastWallTeam===p.team){this.wallReturns++;this.emit('wall-return');}
    this.message=kind==='lob'?'Lob!':kind==='smash'?'Smash!':'Rally on';this.emit('hit',{kind,player:p.id});
    return true;
  }
  updatePlayers(dt,input) {
    const b=this.ball;const receiving=this.rally?1-this.rally.lastTeam:1-Math.floor(this.score.server/2);
    const prediction=this.predict();
    const possible=this.players.filter(p=>p.team===receiving && (!this.rally?.isServe || p.id===this.receiver));
    possible.sort((a,b)=>distance(a,prediction)-distance(b,prediction));
    if(this.designatedChaser===null || this.designatedChaser===undefined)this.designatedChaser=possible[0]?.id;
    const chaser=this.players[this.designatedChaser];
    if(receiving===0 && chaser && this.assisted && this.switchLock<=0 && !(input.moveX||input.moveZ))this.controlled=chaser.id;
    for(const p of this.players) {
      p.cooldown=Math.max(0,p.cooldown-dt);p.swing=Math.max(0,p.swing-dt);
      const human=p.id===this.controlled;
      const moving=human && (input.moveX || input.moveZ);
      if(moving) {
        const d=Math.hypot(input.moveX,input.moveZ);
        this.movePlayer(p,{x:p.x+input.moveX/d,z:p.z+input.moveZ/d},input.sprint?8:6.8,dt);
      } else if(!human || this.assisted) {
        const homeX=(p.id%2===0?-2.4:2.4)+clamp(b.x*0.18,-0.5,0.5);
        const homeZ=signOf(p.team)*(p.team===receiving?6.4:3.5);
        const target=p===chaser?{x:prediction.x+(human?0:p.readX),z:prediction.z+(human?0:p.readZ)}:{x:homeX,z:homeZ};
        const speed=human?6.9:p.team===0?5.5:{casual:3.7,club:4.9,pro:6.1}[this.difficulty];
        this.movePlayer(p,target,speed,dt);
      } else {p.vx=0;p.vz=0;}
      if(p.team===receiving) {
        if(human) {if(input.shot)this.hit(p,input.shot,input.aim,input.power);}
        else if(p===chaser || distance(p,b)<0.8) {
          const delay=p.team===0?0.22:{casual:0.48,club:0.3,pro:0.2}[this.difficulty];
          if(this.time-this.lastHitTime>delay)this.hit(p);
        }
      }
    }
  }
  step(dt,input={}) {
    if(this.stage==='over')return;
    this.time+=dt;this.timer+=this.stage==='ready'?dt:0;this.switchLock=Math.max(0,this.switchLock-dt);
    if(input.switch && this.switchLock<=0){this.controlled^=1;this.switchLock=1;}
    if(this.stage==='ready') {
      if(Math.floor(this.score.server/2)===1 ? this.timer>1.25 : input.shot)this.startServe();
      return;
    }
    if(this.stage==='between') {this.timer-=dt;if(this.timer<=0)this.prepareServe();return;}
    const b=this.ball;
    if(this.stage==='serve-bounce') {
      b.vy-=GRAVITY*dt;b.y+=b.vy*dt;
      if(b.y<R){b.y=R;b.vy=3.8;this.servedBounce=true;this.emit('bounce');}
      if(this.servedBounce && b.y>=0.72)this.launchServe();
      return;
    }
    if(this.stage!=='rally')return;
    this.updatePlayers(dt,input);
    if(this.stage!=='rally')return;
    const old={x:b.x,y:b.y,z:b.z};
    b.vy-=GRAVITY*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
    // Swept net collision, so fast shots cannot tunnel through the tape.
    if(old.z*b.z<=0 && old.z!==b.z) {
      const a=old.z/(old.z-b.z), h=old.y+(b.y-old.y)*a, x=old.x+(b.x-old.x)*a;
      if(h-R<=netHeight(x)) {
        if(h+R>=netHeight(x)) {
          this.rally.netTouched=true;b.vx*=0.82;b.vz*=0.72;b.vy=Math.abs(b.vy)*0.2;this.emit('net');
        } else {
          b.z=Math.sign(old.z)*(R+0.015);b.vz*=-0.16;b.vx*=0.45;b.vy*=-0.12;this.emit('net');
        }
      }
    }
    if(b.y<=R && b.vy<0) {
      b.y=R;
      if(this.resolve(this.rally.floor(b.x,b.z)))return;
      b.vy=-b.vy*0.73;b.vx*=0.965;b.vz*=0.965;this.emit('bounce');
    }
    for(const axis of ['x','z']) {
      const limit=(axis==='x'?5:10)-R;
      if(Math.abs(b[axis])<=limit)continue;
      const height=axis==='z'?4:Math.abs(b.z)>8?4:3;
      if(b.y-R>height) {this.resolve(this.rally.out());return;}
      const kind=wallKind(axis,b.y,b.z);
      if(this.resolve(this.rally.wall(kind,sideOf(b.z))))return;
      b[axis]=Math.sign(b[axis])*(2*limit-Math.abs(b[axis]));
      b[axis==='x'?'vx':'vz']*=-0.82;
      if(kind==='fence')b.vy*=0.91;
      this.lastWallTime=this.time;this.lastWallTeam=sideOf(b.z);
      this.emit('wall',{axis,kind,x:b.x,y:b.y,z:b.z});
    }
    // An unreturnable ball cannot keep a point alive forever.
    if(this.time-this.lastHitTime>15)this.resolve({winner:this.rally.lastTeam,reason:'Second bounce'});
  }
}
