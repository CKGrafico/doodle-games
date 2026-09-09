import test from 'node:test';
import assert from 'node:assert/strict';
import { SheepGame, STEP } from '../sheep/simulation.js';
const advance=(g,seconds,input={})=>{for(let i=0;i<seconds/STEP;i++)g.step(STEP,input);};

test('the dog influences autonomous sheep, and idle play does not rescue the flock',()=>{
  const g=new SheepGame();g.start();const s=g.sheep[0];g.player.x=s.x;g.player.z=s.z+2;
  const z=s.z;advance(g,.6);assert.ok(s.z<z);
  const idle=new SheepGame();idle.start();advance(idle,12);assert.equal(idle.saved,0);
});
test('whistle calms nearby sheep and can be renewed; stronger barks reach farther and cause panic',()=>{
  const a=new SheepGame(),b=new SheepGame();a.start();b.start();
  for(const g of [a,b]){g.player={x:0,z:15,vx:0,vz:0};g.aim={x:0,z:0};g.sheep[0].x=0;g.sheep[0].z=10;}
  a.bark(.1);b.bark(1);assert.equal(a.sheep[0].fear,0);assert.ok(b.sheep[0].fear>.5);assert.ok(b.sheep[0].vz<0);
  b.barkCooldown=0;assert.ok(b.whistle());assert.equal(b.sheep[0].fear,0);assert.ok(b.sheep[0].follow>b.whistleCooldown);
  assert.equal(b.whistle(),false);
});
test('fences block calls and motion; the bridge and local gate switch provide valid routes',()=>{
  const g=new SheepGame();g.start();g.player={x:10,z:4,vx:0,vz:0};g.sheep[0].x=10;g.sheep[0].z=0;
  g.whistle();assert.equal(g.sheep[0].follow,0);advance(g,2,{moveZ:-1});assert.ok(g.player.z>2.5);
  const bridge=new SheepGame({level:1});assert.ok(bridge.blocked({x:5,z:0}));assert.equal(bridge.blocked({x:0,z:0}),false);
  const gate=new SheepGame({level:2});gate.start();assert.equal(gate.openGate(),false);assert.ok(gate.blocked({x:5,z:-5}));
  gate.player.x=gate.lever.x;gate.player.z=gate.lever.z;assert.ok(gate.openGate());assert.equal(gate.blocked({x:5,z:-5}),false);
  gate.sheep[0].x=5;gate.sheep[0].z=-5;assert.equal(gate.openGate(),false);assert.equal(gate.gateOpen,true);
});
test('rescues score once, quota allows finishing, and impossible quotas fail',()=>{
  const g=new SheepGame();g.start();for(const s of g.sheep.slice(0,6)){s.x=0;s.z=-17;}
  g.step(STEP);assert.equal(g.saved,6);g.step(STEP);assert.equal(g.saved,6);assert.ok(g.finish());assert.ok(g.stars>=1);
  const failed=new SheepGame({level:2});failed.start();for(const s of failed.sheep.slice(0,4)){s.lost=true;}failed.lost=4;failed.step(STEP);assert.equal(failed.stage,'lost');
});
test('tractor contact loses a sheep once, while relaxed mode and restarts preserve their contracts',()=>{
  const g=new SheepGame({level:2,relaxed:true});g.start();g.sheep[0].x=0;g.sheep[0].z=-9;g.step(STEP);assert.equal(g.lost,1);g.step(STEP);assert.equal(g.lost,1);
  const relaxed=new SheepGame({relaxed:true});relaxed.start();relaxed.time=999;relaxed.step(STEP);assert.equal(relaxed.stage,'playing');
  const timed=new SheepGame();timed.start();timed.time=151;timed.step(STEP);assert.equal(timed.stage,'lost');const t=timed.time;timed.step(1);assert.equal(timed.time,t);
  const fresh=new SheepGame();assert.equal(fresh.stage,'ready');assert.equal(fresh.saved,0);
});

function herd(level) {
  const g=new SheepGame({level,seed:17});g.start();let chosen=null,routeIndex=0;
  const route=level===2?[{x:-5,z:8},{x:-5,z:1},{x:5,z:0},{x:5,z:-6.5},{x:13,z:-6.5},{x:13,z:-12.5},{x:0,z:-17}]:[{x:0,z:6},{x:0,z:-4},{x:0,z:-17}];
  for(let i=0;i<120*230&&g.stage==='playing';i++){
    if(!chosen||chosen.saved||chosen.lost){chosen=g.sheep.filter(s=>!s.saved&&!s.lost).sort((a,b)=>b.z-a.z)[0];routeIndex=0;if(!chosen)break;
      if(level===2){if(chosen.z<4)routeIndex=2;if(chosen.z<-6)routeIndex=4;}else if(chosen.z<3)routeIndex=1;
    }
    let target=route[routeIndex];
    if(routeIndex<route.length-1&&Math.hypot(target.x-chosen.x,target.z-chosen.z)<2.4)target=route[++routeIndex];
    const d=Math.hypot(target.x-chosen.x,target.z-chosen.z)||1;
    let dog={x:chosen.x+(target.x-chosen.x)/d*2.7,z:chosen.z+(target.z-chosen.z)/d*2.7};
    if(level===1&&Math.abs(dog.z)<3)dog.x=Math.max(-2.5,Math.min(2.5,dog.x));
    if(level===2&&!g.gateOpen&&chosen.z<4)dog=g.lever;
    const dx=dog.x-g.player.x,dz=dog.z-g.player.z,n=Math.hypot(dx,dz)||1;
    g.step(STEP,{moveX:dx/n*Math.min(1,n),moveZ:dz/n*Math.min(1,n),whistle:g.whistleCooldown===0,
      gate:level===2&&!g.gateOpen&&Math.hypot(g.player.x-g.lever.x,g.player.z-g.lever.z)<3});
    assert.ok(g.sheep.every(s=>Number.isFinite(s.x)&&Number.isFinite(s.z)));
    if(g.saved>=g.config.quota)g.finish();
  }
  return g;
}
test('every pasture can be won by moving the dog and whistling through its real obstacles',()=>{
  for(let level=0;level<3;level++){const g=herd(level);assert.equal(g.stage,'won',`${level}: ${g.saved} home, ${g.lost} lost, ${g.time.toFixed(1)} s`);assert.ok(g.saved>=g.config.quota);if(level===2)assert.ok(g.gateOpen);}
});
