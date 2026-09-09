import {FIELD,FORMATIONS,clamp,distance,direction,classifyExit,offsidePlayers} from './rules.js';
export const STEP=1/60;
const R=FIELD.ballRadius;
export function seededRandom(seed=81){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let n=Math.imul(seed^seed>>>15,1|seed);n=n+Math.imul(n^n>>>7,61|n)^n;return((n^n>>>14)>>>0)/4294967296;};}

export class FootballGame {
  constructor({duration=180,difficulty='club',formation='433',assisted=true,seed=19}={}){
    this.duration=Number(duration);this.difficulty=difficulty;this.formation=formation;this.assisted=assisted;this.random=seededRandom(seed);
    this.players=Array.from({length:22},(_,id)=>({id,number:id%11+1,team:Math.floor(id/11),keeper:id%11===0,x:0,z:0,vx:0,vz:0,facing:0,kick:0,dive:0,cooldown:0,decision:0,stamina:1,readX:0}));
    this.ball={x:0,y:R,z:0,vx:0,vy:0,vz:0,owner:null};this.half=1;this.elapsed=0;this.time=0;
    this.goals=[0,0];this.stats={shots:[0,0],passes:[0,0],completed:[0,0],saves:[0,0],possession:[0,0]};
    this.controlled=9;this.stage='kickoff';this.timer=0;this.lastTouch=0;this.lastKicker=null;this.kickTime=-10;this.offside=[];
    this.events=[];this.message='Kick-off';this.restart=null;this.pendingPass=null;this.switchLock=0;this.autoSwitch=true;this.aim=null;this.lastGoalTime=-10;
    this.setKickoff(0);
  }
  emit(type,extra={}){this.events.push({type,...extra});}
  drainEvents(){return this.events.splice(0);}
  d(team){return direction(team,this.half);}
  setKickoff(team){
    this.players.forEach(p=>{
      const formation=FORMATIONS[p.team===0?this.formation:'433'][p.id%11];const d=this.d(p.team);
      p.x=formation[0]*30;p.z=(formation[1]*48)*d;
      if(!p.keeper)p.z=-d*Math.max(3,Math.abs(p.z));
      p.vx=p.vz=0;p.facing=p.team===0?Math.PI:0;p.cooldown=0;p.decision=.75;
    });
    const kicker=this.players[team*11+9];kicker.x=0;kicker.z=-this.d(team)*.9;
    const partner=this.players[team*11+6];partner.x=5;partner.z=-this.d(team)*3.5;
    this.ball={x:0,y:R,z:0,vx:0,vy:0,vz:0,owner:kicker.id};
    this.lastTouch=team;this.offside=[];this.pendingPass=null;this.stage='kickoff';this.kickoffTeam=team;this.timer=0;this.restart=null;
    this.controlled=team===0?kicker.id:6;this.message=team===0?'Your kick-off':'District kick-off';this.emit('kickoff',{team});
  }
  move(p,target,speed,dt){
    const dx=target.x-p.x,dz=target.z-p.z,length=Math.hypot(dx,dz);const amount=Math.min(length,speed*dt);
    const ox=p.x,oz=p.z;
    if(length>.08){p.x+=dx/length*amount;p.z+=dz/length*amount;p.facing=Math.atan2(dx,dz);}
    p.x=clamp(p.x,-33.3,33.3);p.z=clamp(p.z,-51.7,51.7);p.vx=(p.x-ox)/dt;p.vz=(p.z-oz)/dt;
  }
  passTarget(p,kind='pass',aim=this.aim){
    const d=this.d(p.team),goal={x:0,z:d*52.5};
    let candidates=this.players.filter(q=>q.team===p.team&&q.id!==p.id&&!q.keeper&&distance(p,q)>3&&distance(p,q)<45);
    const flagged=offsidePlayers(this.players,this.ball,p.team,this.half,this.restart?.type);
    candidates=candidates.filter(q=>!flagged.includes(q.id));
    let best=null,score=-Infinity;
    for(const q of candidates){
      const length=distance(p,q),forward=(q.z-p.z)*d;
      const pressure=Math.min(...this.players.filter(r=>r.team!==p.team).map(r=>distance(r,q)));
      let value=forward*.5+Math.min(pressure,12)*1.6-length*.24;
      if(kind==='through')value+=forward*.9;
      if(kind==='loft')value+=Math.max(0,35-distance(q,goal))*.9;
      if(aim){const ax=aim.x-p.x,az=aim.z-p.z;const al=Math.hypot(ax,az)||1;value+=((q.x-p.x)*ax+(q.z-p.z)*az)/(length*al)*28-distance(q,aim)*.3;}
      if(value>score){score=value;best=q;}
    }
    return best;
  }
  kick(p,kind='pass',aim=null,power=.65){
    if(this.ball.owner!==p.id)return false;
    const d=this.d(p.team),b=this.ball;let target,speed,loft;
    const keeper=this.players[(1-p.team)*11];
    if(kind==='shoot'){
      const placement=aim?clamp(aim.x,-3.1,3.1):clamp(-Math.sign(keeper.x||((this.random()-.5)||1))*2.6+(this.random()-.5)*.65,-3.05,3.05);
      target={x:placement,z:d*55};speed=24+clamp(power,0,1)*11;
      const flight=distance(p,target)/speed;loft=Math.min(8.8,(.7-R+4.905*flight*flight)/flight);
      this.stats.shots[p.team]++;this.pendingPass=null;
    }else{
      const q=this.passTarget(p,kind,aim);
      target=q?{x:q.x,z:q.z+(kind==='through'?d*7:0)}:{x:clamp(p.x+(this.random()-.5)*12,-27,27),z:p.z+d*17};
      if(kind==='loft'&&Math.abs(p.z)>23){target.z=d*43;target.x=clamp(target.x,-12,12);}
      speed=(kind==='through'?24:kind==='loft'?22:19)*(.7+clamp(power,0,1)*(.3/.65));loft=kind==='loft'?8.5:kind==='through'?1.6:1.1;
      this.stats.passes[p.team]++;this.pendingPass={team:p.team,from:p.id,to:q?.id};
      if(q?.team===0){this.controlled=q.id;this.switchLock=.55;}
    }
    this.offside=offsidePlayers(this.players,b,p.team,this.half,this.restart?.type);
    const dx=target.x-p.x,dz=target.z-p.z,length=Math.hypot(dx,dz)||1;
    b.x=p.x+dx/length*.9;b.z=p.z+dz/length*.9;b.y=p.keeper?1:R;
    b.vx=dx/length*speed;b.vz=dz/length*speed;b.vy=loft;b.owner=null;
    this.lastKicker=p.id;this.lastTouch=p.team;this.kickTime=this.time;p.kick=.28;p.cooldown=.52;
    this.players.filter(q=>q.keeper).forEach(q=>q.readX=(this.random()-.5)*({casual:3,club:1.7,pro:.6}[this.difficulty]));
    this.restart=null;this.stage='playing';this.emit('kick',{kind,team:p.team,player:p.id});return true;
  }
  gain(p){
    if(this.offside.includes(p.id)&&this.lastTouch===p.team){this.stop('offside',1-p.team,{x:p.x,z:p.z});return;}
    if(this.pendingPass){if(this.pendingPass.team===p.team&&this.pendingPass.from!==p.id)this.stats.completed[p.team]++;this.pendingPass=null;}
    this.ball.owner=p.id;this.ball.vx=this.ball.vy=this.ball.vz=0;this.lastTouch=p.team;this.offside=[];
    p.decision=.25+this.random()*.2;p.cooldown=.85;
    if(p.team===0&&!p.keeper&&this.autoSwitch){this.controlled=p.id;this.switchLock=.4;}
    this.emit('possession',{team:p.team,player:p.id});
  }
  tackle(p){
    if(p.cooldown>0)return false;p.cooldown=1.0;p.kick=.25;
    const carrier=this.players[this.ball.owner];
    if(!carrier||carrier.team===p.team||carrier.cooldown>0||distance(p,carrier)>2.65)return false;
    carrier.cooldown=1.4;
    this.gain(p);this.emit('tackle',{team:p.team});return true;
  }
  stop(type,team,position={x:0,z:0}){
    this.stage='stoppage';this.timer=2;this.message={'throw-in':'Throw-in',corner:'Corner kick','goal-kick':'Goal kick',offside:'Offside'}[type]||type;
    this.restart={type,team,x:clamp(position.x,-34,34),z:clamp(position.z,-52.5,52.5)};
    this.ball.owner=null;this.ball.vx=this.ball.vy=this.ball.vz=0;this.offside=[];this.pendingPass=null;this.emit('whistle',{reason:type,team});
  }
  placeRestart(){
    const r=this.restart,d=this.d(r.team);let p;
    if(r.type==='goal-kick'){p=this.players[r.team*11];r.x=0;r.z=-d*47;}
    else{
      p=this.players.filter(p=>p.team===r.team&&!p.keeper).sort((a,b)=>distance(a,r)-distance(b,r))[0];
      if(r.type==='corner'){r.x=Math.sign(r.x||1)*33.2;r.z=d*51.6;}
      if(r.type==='throw-in')r.x=Math.sign(r.x||1)*33.2;
    }
    p.x=r.x;p.z=r.z;p.cooldown=0;p.facing=Math.atan2(-r.x,d*20);
    for(const q of this.players)if(q.team!==r.team&&distance(q,p)<9.2){const dx=q.x-p.x,dz=q.z-p.z,len=Math.hypot(dx,dz)||1;q.x=clamp(p.x+dx/len*9.3,-33,33);q.z=clamp(p.z+dz/len*9.3,-51,51);}
    Object.assign(this.ball,{x:p.x,y:r.type==='throw-in'?1.8:R,z:p.z,vx:0,vy:0,vz:0,owner:p.id});
    this.stage='restart';this.timer=0;this.lastTouch=p.team;if(p.team===0)this.controlled=p.id;
  }
  goal(team){
    this.goals[team]++;this.lastGoalTime=this.time;this.stage='goal';this.timer=3.2;this.scoringTeam=team;
    this.message=team===0?'GET IN!':'Goal for the district';this.ball.owner=null;this.ball.vx*=.12;this.ball.vz*=.12;
    this.emit('goal',{team,goals:[...this.goals]});
  }
  looseBall(dt){
    const b=this.ball,old={x:b.x,y:b.y,z:b.z};
    b.vy-=9.81*dt;b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;
    if(b.y<R){b.y=R;b.vy=Math.abs(b.vy)*.49;if(b.vy<.65)b.vy=0;const drag=Math.exp(-.55*dt);b.vx*=drag;b.vz*=drag;}
    const speed=Math.hypot(b.vx,b.vz);if(b.y<=R+.03&&speed>.01){const next=Math.max(0,speed-1.6*dt);b.vx*=next/speed;b.vz*=next/speed;}
    // Swept goal-line intersection: fast shots cannot jump past posts or score
    // above the bar then become valid by falling inside the net.
    for(const end of [-1,1]){
      const plane=end*(52.5+R);
      if((old.z-plane)*(b.z-plane)<=0 && (b.z-old.z)*end>0){
        const t=(plane-old.z)/(b.z-old.z),x=old.x+(b.x-old.x)*t,y=old.y+(b.y-old.y)*t;
        if(Math.abs(Math.abs(x)-3.66)<R+.06 && y<2.44+R){b.z=end*(52.5-R-.08);b.vz*=-.7;b.vx+=(x>0?1:-1)*2;this.emit('post');return;}
        if(Math.abs(y-2.44)<R+.06 && Math.abs(x)<3.66+R){b.z=end*(52.5-R-.08);b.vz*=-.72;b.vy*=-.55;this.emit('post');return;}
        const result=classifyExit({x,y,z:plane+end*.001},this.lastTouch,this.half);
        if(result?.type==='goal'){this.goal(result.team);return;}
        if(result)this.stop(result.type,result.team,{x:x>0?33.2:-33.2,z:end*52.5});return;
      }
    }
    const exit=classifyExit(b,this.lastTouch,this.half);if(exit){if(exit.type==='goal')this.goal(exit.team);else this.stop(exit.type,exit.team,b);return;}
    const candidates=this.players.filter(p=>!(p.id===this.lastKicker&&this.time-this.kickTime<.55)).sort((a,c)=>distance(a,b)-distance(c,b));
    for(const p of candidates){
      const d=this.d(p.team),inBox=b.z*d<-36 && Math.abs(b.x)<20;
      if(p.keeper&&inBox&&this.lastTouch!==p.team&&this.time-this.kickTime>.16){
        if(distance(p,b)<1.85&&b.y<2.55){p.dive=.65;this.stats.saves[p.team]++;this.gain(p);p.decision=.85;this.emit('save',{team:p.team});break;}
      }else if(distance(p,b)<1.24&&b.y<1.35&&p.cooldown<=0){this.gain(p);break;}
    }
  }
  updatePlayers(dt,input){
    const b=this.ball,carrier=this.players[b.owner];
    const teamWithBall=carrier?.team??this.lastTouch;
    const expected={x:clamp(b.x+b.vx*.35,-33,33),z:clamp(b.z+b.vz*.35,-51,51)};
    const nearest=[0,1].map(team=>this.players.filter(p=>p.team===team&&!p.keeper&&p.id!==b.owner).sort((a,c)=>distance(a,expected)-distance(c,expected)));
    if(!carrier && this.autoSwitch && this.switchLock<=0 && !(input.moveX||input.moveZ))this.controlled=nearest[0][0].id;
    for(const p of this.players){
      p.cooldown=Math.max(0,p.cooldown-dt);p.kick=Math.max(0,p.kick-dt);p.dive=Math.max(0,p.dive-dt);p.decision-=dt;
      const human=p.id===this.controlled&&!input.autoplay;const d=this.d(p.team);const attack=teamWithBall===p.team;
      if(p.keeper){
        const ownZ=-d*49.4;let gx=clamp(b.x*.25,-3,3);
        if(!carrier&&b.vz*d<0&&Math.abs(b.vz)>8&&this.time-this.kickTime>.18)gx=clamp(b.x+b.vx*((ownZ-b.z)/b.vz)+p.readX,-4.1,4.1);
        this.move(p,{x:gx,z:ownZ},p.team===0?5.3:{casual:3.6,club:4.5,pro:5.3}[this.difficulty],dt);
        if(b.owner===p.id&&p.decision<=0)this.kick(p,'loft');continue;
      }
      const isCarrier=p.id===b.owner;
      let speed=p.team===0?7.3:{casual:5.5,club:6.5,pro:7.2}[this.difficulty];
      if(isCarrier)speed*=.89;
      if(human&&input.sprint&&p.stamina>.06){speed*=1.4;p.stamina=Math.max(0,p.stamina-dt*.12);}else p.stamina=Math.min(1,p.stamina+dt*.07);
      if(human&&(input.moveX||input.moveZ)){
        const len=Math.hypot(input.moveX,input.moveZ);this.move(p,{x:p.x+input.moveX/len,z:p.z+input.moveZ/len},speed*Math.min(1,len),dt);
      }else if(human&&!this.assisted){p.vx=p.vz=0;}
      else{
        let target;
        if(isCarrier){
          const goal={x:clamp(p.x*.85,-11,11),z:d*49};
          const threat=this.players.filter(q=>q.team!==p.team&&!q.keeper).sort((a,c)=>distance(a,p)-distance(c,p))[0];
          let avoid=0;if(distance(p,threat)<6)avoid=(p.x>=threat.x?1:-1)*(6-distance(p,threat));
          target={x:clamp(goal.x+avoid,-26,26),z:goal.z};
        }else if((!carrier&&nearest[p.team][0]===p)||(!attack&&nearest[p.team].slice(0,2).includes(p)))target=expected;
        else{
          const f=FORMATIONS[p.team===0?this.formation:'433'][p.id%11];
          const progression=clamp(b.z*d*.55+(attack?10:-6),-16,29);
          target={x:clamp(f[0]*29+b.x*.21,-30,30),z:clamp((f[1]*40+progression)*d,-46,46)};
          if(attack&&p.id%11>=8){target.z=clamp(b.z+d*(10+(p.id%11===9?2:0)),-46,46);}
          // Hold attacking runs just behind the second-last defender.
          if(attack){const line=this.players.filter(q=>q.team!==p.team).map(q=>q.z*d).sort((a,c)=>c-a)[1];if(target.z*d>Math.max(b.z*d,line)-1)target.z=d*(Math.max(b.z*d,line)-1);}
        }
        this.move(p,target,speed,dt);
      }
      if(isCarrier && !human && p.decision<=0){
        const range=distance(p,{x:0,z:d*52.5});
        const pressure=Math.min(...this.players.filter(q=>q.team!==p.team).map(q=>distance(p,q)));
        if(range<24&&Math.abs(p.x)<15)this.kick(p,'shoot',null,.5+this.random()*.4);
        else if(pressure<4.3||this.random()<.28)this.kick(p,this.random()<.12?'through':'pass');
        p.decision=.65+this.random()*.8;
      }
      if(!isCarrier&&!human&&carrier&&carrier.team!==p.team&&distance(p,carrier)<1.65&&p.cooldown<=0&&carrier.cooldown<=0)this.tackle(p);
    }
    // Soft separation prevents all twenty outfield players from stacking.
    for(let i=0;i<this.players.length;i++)for(let j=i+1;j<this.players.length;j++){
      const a=this.players[i],c=this.players[j],dx=c.x-a.x,dz=c.z-a.z,len=Math.hypot(dx,dz);
      if(len>0.001&&len<1.15){const push=(1.15-len)*.16;a.x-=dx/len*push;a.z-=dz/len*push;c.x+=dx/len*push;c.z+=dz/len*push;}
    }
  }
  step(dt,input={}){
    if(this.stage==='fulltime')return;
    this.time+=dt;this.switchLock=Math.max(0,this.switchLock-dt);
    if(input.action==='switch'){
      const list=this.players.filter(p=>p.team===0&&!p.keeper).sort((a,b)=>distance(a,this.ball)-distance(b,this.ball));
      this.controlled=(list[0].id===this.controlled?list[1]:list[0]).id;this.switchLock=1.4;
    }
    if(['kickoff','restart'].includes(this.stage)){
      this.timer+=dt;const p=this.players[this.ball.owner];
      if((p.team===0&&!input.autoplay)?['pass','through','loft','shoot'].includes(input.action):this.timer>1.2){
        const type=this.restart?.type;this.kick(p,type==='corner'?'loft':'pass',input.aim,input.power??.65);
      }
      return;
    }
    if(this.stage==='goal'){this.timer-=dt;if(this.timer<=0)this.setKickoff(1-this.scoringTeam);return;}
    if(this.stage==='stoppage'){this.timer-=dt;if(this.timer<=0)this.placeRestart();return;}
    if(this.stage==='halftime'){this.timer-=dt;if(this.timer<=0){this.half=2;this.setKickoff(1);}return;}
    if(this.stage!=='playing')return;
    this.elapsed+=dt;
    if(this.half===1&&this.elapsed>=this.duration/2){this.stage='halftime';this.timer=3;this.message='Half-time. Change ends.';this.emit('halftime');return;}
    if(this.elapsed>=this.duration){this.elapsed=this.duration;this.stage='fulltime';this.message='Full-time';this.emit('fulltime',{goals:[...this.goals]});return;}
    if(this.ball.owner!==null)this.stats.possession[this.players[this.ball.owner].team]+=dt;
    const human=this.players[this.controlled];
    if(input.action==='tackle')this.tackle(human);
    if(['pass','through','loft','shoot'].includes(input.action)&&this.ball.owner===human.id)this.kick(human,input.action,input.aim,input.power??.65);
    this.updatePlayers(dt,input);
    if(this.stage!=='playing')return;
    if(this.ball.owner!==null){const p=this.players[this.ball.owner];this.ball.x=p.x+Math.sin(p.facing)*.85;this.ball.z=p.z+Math.cos(p.facing)*.85;this.ball.y=p.keeper?1:R+Math.abs(Math.sin(this.time*10))*.035;}
    else this.looseBall(dt);
  }
}
