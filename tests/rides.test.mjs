import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame } from '../surf/simulation.js';
import { SkiGame } from '../ski/simulation.js';
import { launchAir, stepAir, angleError } from '../shared/ride-physics.js';
const stepFor = (g, seconds, input = {}) => { for(let i=0;i<seconds*120;i++)g.step(1/120,input); };

test('surf idle play earns nothing while deliberate cutbacks complete a scored three-wave heat',()=>{
  const idle=new SurfGame();idle.start();stepFor(idle,30);assert.equal(idle.total+idle.comboValue,0);
  const g=new SurfGame();g.start();let direction=1;
  for(let i=0;i<22000&&g.stage!=='finished';i++){
    if(g.stage==='between')g.continue();
    if(g.x>3)direction=-1;if(g.x< -3)direction=1;
    g.step(1/120,{steer:direction*.6});
  }
  assert.equal(g.stage,'finished');assert.equal(g.scores.length,3);
  assert.ok(g.stats.cutbacks>=3&&g.total>1000);
  assert.equal(g.total,[...g.scores].sort((a,b)=>b-a).slice(0,2).reduce((a,b)=>a+b));
});
test('a barrel scores only on a safe sustained exit and only once per section',()=>{
  const g=new SurfGame();g.start();const tube=g.sections[0];g.z=tube.z+.1;g.x=tube.x;g.vx=0;
  stepFor(g,.8);assert.equal(g.stats.tubes,0);stepFor(g,.6);assert.equal(g.stats.tubes,0);
  assert.ok(g.inTube && g.tubePoints > 150);
  for(let i=0;i<120&&g.inTube;i++)g.step(1/120,{steer:-.5});
  assert.equal(g.stats.tubes,1);assert.ok(g.comboValue>=320);assert.ok(tube.done);
  g.z=tube.z+1;g.x=tube.x;g.vx=0;g.heading=0;stepFor(g,1.5);assert.equal(g.stats.tubes,1);
});
test('surf carving carries momentum, descending gains speed and trimming outruns the curl',()=>{
  const down=new SurfGame(),up=new SurfGame();down.start();up.start();
  down.x=up.x=0;stepFor(down,.5,{steer:-.6});stepFor(up,.5,{steer:.6});
  assert.ok(down.speed>up.speed);assert.ok(down.heading<0&&down.vx<0);
  const heading=down.heading;down.step(1/120,{steer:1});assert.ok(down.heading<0&&down.heading>heading);
  const g=new SurfGame();g.start();g.shoulder=0;g.speed=14;stepFor(g,2,{trim:true});assert.ok(g.shoulder>0&&g.falls===0);
  g.shoulder=-7.99;g.speed=5;g.step(.1);assert.equal(g.falls,1);stepFor(g,1.3);assert.equal(g.recovery,0);
});
test('tube overbalance loses unbanked points, Special needs earned meter and expires',()=>{
  const g=new SurfGame();g.start();assert.equal(g.activateSpecial(),false);
  for(let i=0;i<7;i++)g.trick('Move '+i,100,'move'+i);
  assert.equal(g.activateSpecial(),true);const before=g.comboValue;g.trick('Air',100,'air');assert.ok(g.comboValue-before>200);
  g.bank();const banked=g.score;g.trick('Risk',100);g.z=g.sections[0].z+1;g.x=g.sections[0].x;g.balance=1.01;g.step(1/120);
  assert.equal(g.falls,1);assert.equal(g.comboValue,0);assert.equal(g.score,banked);assert.equal(g.specialTime,0);
  const timed=new SurfGame();timed.start();timed.special=1;timed.activateSpecial();stepFor(timed,8.1);assert.equal(timed.specialTime,0);
});
test('free surf continues past three waves without a blocking heat result',()=>{
  const g=new SurfGame({practice:true});g.start();
  for(let i=0;i<4;i++){g.trick('Cutback',100);g.nextWave();assert.equal(g.stage,'riding');}
  assert.equal(g.wave,5);assert.equal(g.scores.length,4);assert.ok(g.total>0);
});
test('variety raises combo value; a fall loses pending points but preserves banked score',()=>{
  const g=new SurfGame();g.start();g.trick('Cutback',100,'cutback');g.bank();assert.equal(g.score,100);
  g.trick('Cutback',100,'cutback');const repeated=g.comboValue;
  g.trick('Barrel',100,'tube');assert.ok(g.comboValue-repeated>repeated);
  g.wipeout();assert.equal(g.score,100);assert.equal(g.comboValue,0);
  stepFor(g,1.3);g.trick('Air',100,'air');stepFor(g,5.1);
  assert.ok(g.score>100);assert.equal(g.comboValue,0);
});
test('surf power changes pumping, lip launches can land scored 360s and failures wipe out',()=>{
  const a=new SurfGame(),b=new SurfGame();a.start();b.start();a.action(.1);b.action(.9);assert.ok(b.speed>a.speed);
  const g=new SurfGame();g.start();g.x=4.5;g.speed=13;g.z=150;assert.ok(g.action(1));
  const duration=g.air;assert.ok(duration>1.6);
  stepFor(g,.88,{steer:1});stepFor(g,duration-.88+.1);
  assert.equal(g.falls,0);assert.ok(g.stats.spins>=1&&g.comboValue>350);
  g.cooldown=0;g.x=4.5;g.energy=1;g.action(.5);
  while(g.air>.3)g.step(1/120);stepFor(g,.4,{steer:1});assert.equal(g.falls,1);
});
test('releasing rotation assists a clean full-turn landing; a late held spin can fail',()=>{
  const a={},b={};launchAir(a,1.6);launchAir(b,1.6);let good,bad;
  for(let i=0;i<193;i++){
    good=stepAir(a,1/120,i<105?1:0,i>120)??good;
    bad=stepAir(b,1/120,i>160?1:0,false)??bad;
  }
  assert.ok(good.clean&&good.grabbed);assert.equal(good.turns,1);
  assert.equal(bad.clean,false);assert.ok(Math.abs(angleError(b.spin))>.8);
});
function race(course,play){
  const g=new SkiGame({course});g.start();g.testRivalExcursion=0;
  for(let i=0;i<22000&&g.stage==='riding';i++){
    const target=g.gates[g.nextGate]?.x??0;
    const steer=g.air?0:Math.max(-1,Math.min(1,(target-g.x)*.7-g.vx*.12));
    if(play&&g.canAct&&g.energy>.6&&Math.abs(target-g.x)<2)g.action(.8);
    g.step(1/120,play?{steer}:{});
    g.testRivalExcursion=Math.max(g.testRivalExcursion,...g.rivals.map(r=>Math.abs(r.x)));
    assert.ok(Number.isFinite(g.x)&&Number.isFinite(g.speed));
  }
  return g;
}
test('all ski courses finish with progressing rivals and active racing beats coasting',()=>{
  for(let course=0;course<3;course++){
    const g=race(course,true),idle=race(course,false);
    assert.equal(g.stage,'finished');assert.equal(g.passed,g.gates.length);
    assert.ok(g.total<idle.total);assert.ok(g.rank<=2);
    assert.ok(g.rivals.every(r=>r.z>g.length*.65&&r.passed>8&&Number.isFinite(r.speed)));
    assert.ok(g.testRivalExcursion>2);
  }
});
test('swept ski gates score once, refill boost, and missed gates reduce speed',()=>{
  const g=new SkiGame();g.start();g.z=44.9;g.x=0;g.speed=28;g.energy=.1;
  g.step(1/120);assert.equal(g.passed,1);assert.ok(g.energy>.2);
  g.step(1/120);assert.equal(g.passed,1);
  g.z=g.gates[1].z-.1;g.x=-4;g.vx=0;const speed=g.speed;
  g.step(1/120);assert.equal(g.missed,1);assert.ok(g.speed<speed);assert.equal(g.streak,0);
});
test('charging a ramp increases airtime and distinct boost lines replenish energy',()=>{
  const air=[];
  for(const charged of [false,true]){
    const g=new SkiGame();g.start();const ramp=g.features.find(f=>f.type==='ramp');
    g.x=ramp.x;g.z=ramp.z-.1;g.speed=20;g.nextGate=g.gates.filter(t=>t.z<g.z).length;
    if(charged){assert.equal(g.actionLabel,'LOAD JUMP');g.action(.9);}
    g.step(1/120);assert.ok(g.air>0);air.push(g.air);
    while(g.air)g.step(1/120);assert.equal(g.jumps,1);assert.ok(g.boost>0);
  }
  assert.ok(air[1]>air[0]);
  const g=new SkiGame();g.start();const f=g.features.find(f=>f.type==='boost');
  g.x=f.x;g.z=f.z-.1;g.speed=20;g.energy=.1;g.nextGate=g.gates.filter(t=>t.z<g.z).length;
  g.step(1/120);assert.ok(g.energy>.3);assert.ok(g.used.has(f.id));
});
test('rocks cause recoverable falls while airborne racers clear the same crossing',()=>{
  for(const airborne of [false,true]){
    const g=new SkiGame();g.start();const rock=g.rocks[0];
    g.x=rock.x;g.z=rock.z-.1;g.speed=23;g.nextGate=g.gates.filter(t=>t.z<g.z).length;
    if(airborne)launchAir(g,1.5);
    g.step(1/120);assert.equal(g.falls,airborne?0:1);
    if(!airborne){stepFor(g,1.1);assert.equal(g.recovery,0);}
  }
});
test('lobby and completed rides do not advance and restarts reset their state',()=>{
  for(const Game of [SurfGame,SkiGame]){
    const g=new Game();g.step(1);assert.equal(g.time,0);g.start();stepFor(g,1);
    g.stage='finished';const time=g.time,z=g.z;g.step(1);
    assert.equal(g.time,time);assert.equal(g.z,z);assert.equal(g.action(1),false);
    const fresh=new Game();assert.equal(fresh.falls,0);assert.equal(fresh.time,0);
  }
});
