import test from 'node:test';
import assert from 'node:assert/strict';
import { SurfGame } from '../surf/simulation.js';
import { SkiGame } from '../ski/simulation.js';

test('surf completes three scored waves and keeps only the best two',()=>{
  const g=new SurfGame();g.start();
  for(let i=0;i<10000&&g.stage!=='finished';i++){
    const target=Math.sin(g.time*.7)*3;
    g.step(1/120,{steer:Math.max(-.6,Math.min(.6,(target-g.x)*.6)),brake:g.speed>11});
  }
  assert.equal(g.stage,'finished');assert.equal(g.scores.length,3);
  assert.ok(g.scores.every(n=>n>50));
  assert.equal(g.total,[...g.scores].sort((a,b)=>b-a).slice(0,2).reduce((a,b)=>a+b));
});
test('surf power changes pumping and airs require speed, lip position and a clean landing',()=>{
  const a=new SurfGame(),b=new SurfGame();a.start();b.start();a.action(.2);b.action(.9);assert.ok(b.speed>a.speed);
  b.x=5;b.speed=10;assert.ok(b.action(.5));assert.ok(b.air>0);
  for(let i=0;i<150;i++)b.step(1/120,{steer:0,brake:true});
  assert.equal(b.falls,0);assert.ok(b.score>60);
  b.x=8;b.step(1/120);assert.equal(b.falls,1);assert.ok(b.recovery>0);
  for(let i=0;i<220;i++)b.step(1/120);assert.equal(b.recovery,0);
});
test('ski braking slows a descent, gates score once and misses add time',()=>{
  const a=new SkiGame(),b=new SkiGame();a.start();b.start();
  for(let i=0;i<240;i++){a.step(1/120);b.step(1/120,{brake:true});}
  assert.ok(a.speed>b.speed);
  const g=new SkiGame();g.start();g.z=39.9;g.speed=20;g.step(1/120);assert.equal(g.passed,1);
  g.step(1/120);assert.equal(g.passed,1);
  g.z=79.9;g.x=-4;g.step(1/120);assert.equal(g.missed,1);assert.equal(g.penalty,3);
});
test('a controlled full ski run clears all twenty gates and reaches the finish',()=>{
  const g=new SkiGame();g.start();
  for(let i=0;i<30000&&g.stage!=='finished';i++){
    const gate=g.gates[g.nextGate];const target=gate?.x??0;
    const steer=Math.max(-.7,Math.min(.7,(target-g.x)*.8-g.vx*.12));
    g.step(1/120,{steer,brake:g.speed>12});
    assert.ok(Number.isFinite(g.x)&&Number.isFinite(g.speed));
  }
  assert.equal(g.stage,'finished');assert.equal(g.passed,20);assert.equal(g.missed,0);
});
test('ski hops clear rocks, grounded collisions penalize and recover',()=>{
  for(const airborne of [false,true]){
    const g=new SkiGame();g.start();g.x=-6;g.z=144.9;g.speed=20;g.nextGate=3;
    if(airborne)g.action(.7);
    g.step(1/120);assert.equal(g.falls,airborne?0:1);
    if(!airborne){assert.equal(g.penalty,2);for(let i=0;i<150;i++)g.step(1/120);assert.equal(g.recovery,0);}
  }
});
