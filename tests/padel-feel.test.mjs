import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { PadelGame, FIXED_STEP } from '../padel/simulation.js';
import { Rally } from '../padel/rules.js';
import { moveAthlete, PadelClock, PadelPresentation, strokePose } from '../padel/feel.js';
import { courtCameraPose, PlayerEye } from '../padel/camera.js';
import { cameraFrame } from '../shared/cameras.js';
import { installShotButtons } from '../padel/input.js';
import { CourtView } from '../padel/render.js';
import { batchStaticInk } from '../padel/static-ink.js';

function athlete() { return { x: 0, z: 5, vx: 0, vz: 0, team: 0 }; }
function walk(p, direction, ticks) {
  for (let i=0;i<ticks;i++) moveAthlete(p,{x:p.x+direction,z:p.z},direction?6.8:0,FIXED_STEP);
}
function incoming(mode='quick', height=1) {
  const game=new PadelGame({mode,assisted:false,seed:17});
  game.stage='rally';game.time=5;game.lastHitTime=4;game.controlled=0;
  game.rally=new Rally(1,-2,0);game.rally.isServe=false;game.rally.bounces=1;
  Object.assign(game.players[0],{x:0,z:4,vx:0,vz:0});
  Object.assign(game.ball,{x:.6,y:height,z:4.4,vx:0,vy:0,vz:0});
  return game;
}

test('padel responds on the first tick, reaches pace quickly, brakes and reverses without a velocity jump',()=>{
  const p=athlete();walk(p,1,1);
  assert.ok(p.x>0&&p.vx>0&&p.vx<1);
  walk(p,1,12);assert.ok(Math.abs(p.vx-6.8)<1e-9);
  walk(p,-1,1);assert.ok(p.vx>0&&p.vx<6.8);
  walk(p,-1,17);assert.ok(Math.abs(p.vx+6.8)<1e-9);
  const start=p.x;walk(p,0,12);
  assert.equal(p.vx,0);assert.ok(start-p.x>0&&start-p.x<.3);
});

test('padel slides along a boundary and stops precisely at an AI target',()=>{
  const p=athlete();p.x=4.55;
  for(let i=0;i<60;i++)moveAthlete(p,{x:p.x+1,z:p.z-1},8,FIXED_STEP);
  assert.equal(p.x,4.58);assert.equal(p.vx,0);assert.ok(p.z<3&&p.vz<0);
  const q=athlete(),target={x:.37,z:4.63};
  for(let i=0;i<240;i++)moveAthlete(q,target,6.8,FIXED_STEP);
  assert.ok(Math.hypot(q.x-target.x,q.z-target.z)<.016);
  assert.ok(Math.hypot(q.vx,q.vz)<.01);
});

test('releasing manual movement never triggers a late assisted partner switch',()=>{
  const game=incoming();game.assisted=true;
  for(const player of game.players)player.cooldown=10;
  Object.assign(game.ball,{x:3,y:1,z:7});game.players[1].x=3;game.players[1].z=7;
  game.designatedChaser=null;
  game.updatePlayers(FIXED_STEP,{moveX:1,moveZ:0});
  assert.equal(game.controlled,0);assert.equal(game.designatedChaser,1);
  game.time+=1;game.updatePlayers(FIXED_STEP,{});assert.equal(game.controlled,0);
  game.designatedChaser=null;game.updatePlayers(FIXED_STEP,{});assert.equal(game.controlled,1);
});

test('holding switch does not repeatedly change the controlled player',()=>{
  const game=new PadelGame();
  for(let i=0;i<300;i++)game.step(FIXED_STEP,{switch:true});
  assert.equal(game.controlled,1);
  game.step(FIXED_STEP,{});game.step(FIXED_STEP,{switch:true});assert.equal(game.controlled,0);
});

test('render snapshots interpolate positions without modifying physics and snap on serves and contacts',()=>{
  const game=incoming(),presentation=new PadelPresentation(game),x=game.players[0].x;
  game.updatePlayers(FIXED_STEP,{moveX:1,moveZ:0});
  const actual=game.players[0].x;
  assert.equal(presentation.sample(game,0).players[0].x,x);
  assert.equal(presentation.sample(game,.5).players[0].x,(x+actual)/2);
  assert.equal(game.players[0].x,actual);
  game.prepareServe();assert.equal(presentation.sample(game,0).players[0].x,game.players[0].x);
  const rally=incoming(),contact=new PadelPresentation(rally);
  assert.ok(rally.hit(rally.players[0],'drive',{x:2,z:-7}));
  rally.ball.x+=.1;
  assert.equal(contact.sample(rally,0).ball.x,rally.ball.x);
});

test('the production fixed-step loop produces the same match at 30, 60, 120, 144 and 240 Hz',()=>{
  const outcomes=[];
  for(const hz of [30,60,120,144,240]){
    const game=new PadelGame({seed:211}),clock=new PadelClock(),presentation=new PadelPresentation(game);
    let steps=0;
    for(let frame=0;frame<hz*12;frame++){
      const result=clock.advance(1/hz,game,()=>({shot:'drive',aim:{x:Math.sin(game.time)*3,z:-8}}),presentation);
      steps+=result.steps;presentation.sample(game,result.alpha);
    }
    assert.equal(steps,1440);
    outcomes.push(JSON.stringify({ball:game.ball,players:game.players,score:game.score,stage:game.stage}));
  }
  assert.equal(new Set(outcomes).size,1);
  const game=new PadelGame(),clock=new PadelClock(),presentation=new PadelPresentation(game);
  const hitch=clock.advance(1,game,()=>({}),presentation);
  assert.equal(hitch.steps,8);assert.ok(hitch.dropped>.9);
  clock.reset();assert.equal(clock.accumulator,0);
});

test('racket preparation precedes the strike, contact starts at extension, and recovery is finite',()=>{
  const game=incoming(),p=game.players[0];
  game.updatePlayers(FIXED_STEP,{preparing:'drive'});assert.ok(p.preparation>0);assert.equal(game.rallyHits,0);
  assert.ok(game.hit(p,'drive',{x:2,z:-8}));
  const contact=strokePose(p);assert.ok(contact.locked&&contact.armX<-1.5);
  const events=game.drainEvents().filter(event=>event.type==='hit');
  assert.equal(events.length,1);assert.equal(events[0].time,p.stroke.time);
  for(let i=0;i<60;i++)game.step(FIXED_STEP,{});
  assert.equal(p.swing,0);assert.ok(!strokePose(p).locked);
});

test('volley, lob and smash use distinct strokes and illegal heights stay unreturnable',()=>{
  const poses=[];
  for(const kind of ['drive','lob','smash']){
    const game=incoming('quick',kind==='smash'?2.5:1);
    if(kind==='drive')game.rally.bounces=0;
    assert.ok(game.hit(game.players[0],kind,{x:2,z:-8}));
    assert.equal(game.players[0].stroke.kind,kind==='drive'?'volley':kind);
    poses.push(strokePose(game.players[0]).armX);
  }
  assert.equal(new Set(poses).size,3);
  const high=incoming('quick',3.6);assert.equal(high.hit(high.players[0],'smash',high.aim),false);
  const serve=incoming();serve.rally.isServe=true;serve.rally.bounces=0;
  assert.equal(serve.contactState(serve.players[0]).hint,'Let the serve bounce');
  assert.equal(serve.hit(serve.players[0],'drive',serve.aim),false);
});

test('practice targets can be completed through real rallies and survive an immediate new feed',()=>{
  const game=new PadelGame({mode:'practice',seed:17});let placements=0;
  for(let i=0;i<120*300&&game.practice.placements<3;i++){
    game.step(FIXED_STEP,{shot:'drive',aim:game.practiceTarget});
    for(const event of game.drainEvents())if(event.type==='placement')placements++;
  }
  assert.ok(game.practice.placements>=3);assert.equal(placements,game.practice.placements);
  assert.ok(game.bestRally>=3);assert.notEqual(game.stage,'over');
  const score=game.practice.placements,best=game.bestRally,revision=game.poseVersion;
  assert.ok(game.retryPractice());assert.equal(game.stage,'serve-bounce');
  assert.equal(game.practice.placements,score);assert.equal(game.bestRally,best);assert.ok(game.poseVersion>revision);
  assert.equal(new PadelGame().retryPractice(),false);
  const idle=new PadelGame({mode:'practice'});
  for(let i=0;i<2400;i++)idle.step(FIXED_STEP,{});
  assert.equal(idle.practice.placements,0);
});

test('court framing fits its glass and boundaries at portrait and landscape canvas sizes',()=>{
  for(const aspect of [320/300,390/480,768/670,1280/380,500/240])for(const raised of [false,true]){
    const {eye,center}=courtCameraPose(aspect,39,raised),camera=new THREE.PerspectiveCamera(39,aspect,.1,180);
    camera.position.copy(eye);camera.lookAt(center);camera.updateMatrixWorld();
    for(const x of [-5.5,5.5])for(const y of [0,4])for(const z of [-10.5,10.5]){
      const point=new THREE.Vector3(x,y,z).project(camera);
      assert.ok(Math.abs(point.x)<=.881&&Math.abs(point.y)<=.881,`${aspect}: ${point.toArray()}`);
    }
  }
});

test('first-person switches ease position, keep a stable look direction and snap on reset',()=>{
  const game=new PadelGame(),eye=new PlayerEye();let point=eye.update(game,1/60),start=[...point];
  game.controlled=1;point=eye.update(game,1/120);
  const target=game.players[1];
  assert.ok(Math.abs(point[0]-start[0])<Math.abs(target.x-start[0]));
  const pose=cameraFrame('padel',game,{cameraState:game,playerEye:point});
  assert.equal(pose.look[0],pose.eye[0]);assert.equal(pose.look[2]-pose.eye[2],-12);
  for(let i=0;i<24;i++)point=eye.update(game,1/120);
  assert.equal(point[0],target.x);assert.equal(point[2],target.z);
  game.prepareServe();point=eye.update(game,0);
  assert.equal(point[0],game.players[game.controlled].x);
});

test('touch shot ownership survives other fingers and cancellation never fires a tap',()=>{
  const buttons=['drive','lob'].map(kind=>{
    const button=new EventTarget();button.dataset={shot:kind};button.setPointerCapture=()=>{};return button;
  });
  let held=null,taps=0;
  const controls=installShotButtons(buttons,{active:()=>true,focus(){},change:value=>held=value,tap:()=>taps++});
  const send=(button,type,id)=>{const event=new Event(type,{cancelable:true});Object.assign(event,{pointerId:id,button:0});button.dispatchEvent(event);};
  send(buttons[0],'pointerdown',1);send(buttons[0],'pointerdown',2);send(buttons[0],'pointerup',2);assert.equal(held,'drive');
  send(buttons[1],'pointerdown',3);assert.equal(held,'lob');
  send(buttons[1],'pointercancel',3);assert.equal(held,'drive');assert.equal(taps,0);
  controls.clear();assert.equal(held,null);
  send(buttons[0],'pointerup',1);assert.equal(taps,0);
});

test('static line batching preserves disjoint world-space segments',()=>{
  const scene=new THREE.Scene(),material=new THREE.LineBasicMaterial({color:0x2a42ad});
  for(const x of [1,10]){
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(1,0,0),new THREE.Vector3(1,1,0)]),material);
    line.position.x=x;scene.add(line);
  }
  const result=batchStaticInk(scene);assert.deepEqual(result,{before:2,after:1});
  const attr=scene.children[0].geometry.attributes.position;assert.equal(attr.count,8);
  assert.deepEqual([attr.getX(0),attr.getX(3),attr.getX(4),attr.getX(7)],[1,2,10,11]);
});

test('the real static padel scene batches court strokes and posts before adding players',()=>{
  const view=Object.create(CourtView.prototype);
  view.scene=new THREE.Scene();view.materials=new Map();view.lineMaterials=new Map();
  view.textSprite=()=>new THREE.Object3D();view.buildCourt();view.buildDistrict();
  const result=batchStaticInk(view.scene);
  assert.ok(result.before>300);assert.ok(result.after<40);assert.ok(result.before/result.after>10);
  const instances=view.scene.children.filter(object=>object.isInstancedMesh);
  assert.equal(instances.length,2);assert.ok(instances.every(object=>object.boundingSphere.radius>0));
  console.log(`Padel static strokes/posts: ${result.before} render objects become ${result.after}. GPU timing not measured.`);
});
