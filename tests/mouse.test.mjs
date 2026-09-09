import test from 'node:test';
import assert from 'node:assert/strict';
import { Charge, installCharge } from '../shared/charge.js';
import { PadelGame } from '../padel/simulation.js';
import { PickleballGame } from '../pickleball/simulation.js';
import { FootballGame } from '../football/simulation.js';
import { WaterPoloGame } from '../waterpolo/simulation.js';
import { GolfGame } from '../golf/simulation.js';
import { trajectory as bouleTrajectory } from '../petanca/simulation.js';
import { trajectory as stoneTrajectory } from '../curling/simulation.js';
import { PoolGame } from '../pool/simulation.js';

test('charging depends on elapsed time, caps at full and releases only once', () => {
 for(const fps of [30,60,144]){const c=new Charge();c.begin(0,'rally');for(let t=0;t<1100;t+=1000/fps)c.power(t);assert.equal(c.release(1100,'rally'),1);assert.equal(c.release(1200,'rally'),null);}
 const c=new Charge();c.begin(0,1);assert.equal(c.release(300,2),null);c.begin(0,3);c.cancel();assert.equal(c.release(1000,3),null);
});
test('pointer capture, cancellation, stale turns and release outside do not fire ghost shots', () => {
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 globalThis.window=new EventTarget();globalThis.document=new EventTarget();
 const canvas=new EventTarget();let captured=null,context='turn1',enabled=true,shots=0,cancels=0;
 canvas.focus=()=>{};canvas.setPointerCapture=id=>captured=id;canvas.hasPointerCapture=id=>captured===id;
 canvas.releasePointerCapture=()=>{captured=null;canvas.dispatchEvent(new Event('lostpointercapture'));};
 const event=(type,props={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:1,button:0,pointerType:'mouse',...props});canvas.dispatchEvent(e);return e;};
 try{
 const controller=installCharge({canvas,enabled:()=>enabled,context:()=>context,fire:()=>shots++,cancelled:()=>cancels++});
 event('pointerdown');assert.equal(captured,1);assert.equal(shots,0);
 event('pointerup',{clientX:-100,clientY:-100});assert.equal(shots,1);event('pointerup');assert.equal(shots,1);
 for(const type of ['pointercancel','lostpointercapture']){event('pointerdown');event(type);event('pointerup');assert.equal(shots,1);}
 event('pointerdown');event('pointerdown',{button:2});event('pointerup');assert.equal(shots,1);
 event('pointerdown');context='turn2';controller.update();event('pointerup');assert.equal(shots,1);
 event('pointerdown');window.dispatchEvent(new Event('blur'));event('pointerup');assert.equal(shots,1);
 event('pointerdown');document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));event('pointerup');assert.equal(shots,1);
 document.hidden=false;event('pointerdown');enabled=false;event('pointerup');assert.equal(shots,1);
 enabled=true;event('pointerdown',{pointerType:'touch'});event('pointerup',{pointerType:'touch'});assert.equal(shots,1);assert.ok(cancels>=6);
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
test('racket power changes pace while default and explicit default agree', () => {
 for(const Game of [PadelGame,PickleballGame]){
  const speeds=[];
  for(const power of [.1,.65,1]){const g=new Game();Object.assign(g.ball,{x:0,z:4,y:2});g.launch({x:1,z:-5},'drive',power);speeds.push(Math.hypot(g.ball.vx,g.ball.vz));}
  assert.ok(speeds[0]<speeds[1]&&speeds[1]<=speeds[2]);
  const a=new Game(),b=new Game();a.launch({x:1,z:-5},'drive');b.launch({x:1,z:-5},'drive',.65);assert.deepEqual(a.ball,b.ball);
 }
});
test('team mouse power affects both passes and shots', () => {
 for(const [Game,method] of [[FootballGame,'kick'],[WaterPoloGame,'throw']])for(const kind of ['pass','shoot']){
  const speeds=[];for(const power of [.1,1]){const g=new Game();g[method](g.players[g.ball.owner],kind,null,power);speeds.push(Math.hypot(g.ball.vx,g.ball.vz));}
  assert.ok(speeds[1]>speeds[0],`${Game.name} ${kind}`);
 }
});
test('precision power changes real golf, boule, stone and pool launches', () => {
 const golf=[];for(const power of [.1,1]){const g=new GolfGame();g.power=power;g.shoot();golf.push(Math.hypot(g.ball.vx,g.ball.vz,g.ball.vy));}assert.ok(golf[1]>golf[0]);
 const short=bouleTrajectory(3,'point',0),long=bouleTrajectory(12,'point',0);assert.ok(Math.abs(long.initial.vz)>Math.abs(short.initial.vz));
 assert.ok(stoneTrajectory(.65,0,0).end.z<stoneTrajectory(.3,0,0).end.z);
 const pool=[];for(const power of [.1,1]){const g=new PoolGame();g.shoot(power);pool.push(Math.hypot(g.balls[0].vx,g.balls[0].vz));}assert.ok(pool[1]>pool[0]);
});

test('ride touch charging survives a second steering finger but a menu cancels it', () => {
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 globalThis.window=new EventTarget();globalThis.document=new EventTarget();
 const button=new EventTarget();let captured=null,shots=0;
 button.focus=()=>{};button.setPointerCapture=id=>captured=id;button.hasPointerCapture=id=>captured===id;button.releasePointerCapture=()=>captured=null;
 const send=(target,type,props={})=>{const event=new Event(type,{cancelable:true});Object.assign(event,{pointerId:7,button:0,pointerType:'touch',...props});target.dispatchEvent(event);};
 try {
   const charge=installCharge({canvas:button,enabled:()=>true,context:()=>1,allowTouch:true,fire:()=>shots++,allowConcurrent:event=>event.steering===true});
   send(button,'pointerdown');send(document,'pointerdown',{steering:true});assert.equal(charge.charging,true);
   send(button,'pointerup');assert.equal(shots,1);
   send(button,'pointerdown');send(document,'pointerdown');send(button,'pointerup');assert.equal(shots,1);
   send(button,'pointerdown');send(button,'pointercancel');send(button,'pointerup');assert.equal(shots,1);
 } finally {globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
