import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { installViews } from '../shared/cameras.js';
import { movement } from '../shared/controls.js';
import { GolfGame } from '../golf/simulation.js';
import { PoolGame } from '../pool/simulation.js';
import { CurlingGame } from '../curling/simulation.js';
import { PetancaGame } from '../petanca/simulation.js';
import { PadelGame } from '../padel/simulation.js';

function fixture(kind, game) {
  const old = { document: globalThis.document, window: globalThis.window };
  class Element extends EventTarget {
    constructor() { super(); this.children=[]; this.style={}; }
    append(...items) { this.children.push(...items); }
    setAttribute() {} focus() {} matches() { return false; }
    getBoundingClientRect() { return {left:0,top:0,width:800,height:600}; }
  }
  const doc = new EventTarget(), win = new EventTarget(), parent = new Element(), canvas = new Element();
  Object.assign(doc, {createElement:()=>new Element(),body:new Element(),getElementById:()=>null,querySelector:()=>parent,
    exitPointerLock() { this.pointerLockElement=null;this.dispatchEvent(new Event('pointerlockchange')); }});
  canvas.requestPointerLock = () => {doc.pointerLockElement=canvas;doc.dispatchEvent(new Event('pointerlockchange'));};
  globalThis.document=doc;globalThis.window=win;
  let active=true,charging=false,cleared=0;
  const camera=new THREE.PerspectiveCamera(40,1,.1,500);
  const view={canvas,camera,renderer:{render(){}},resize(){},render(){this.renderer.render({},this.camera);},aimAt:(x,y)=>({x,z:y})};
  const views=installViews(view,kind,()=>{cleared++;charging=false;},{active:()=>active,canAim:()=>game.stage==='aim'||kind==='padel'||kind==='petanca',charging:()=>charging});
  views.setMode('first');view.render(game);
  const send=(type,values={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,{pointerType:'mouse',clientX:400,clientY:300,movementX:0,movementY:0,...values});canvas.dispatchEvent(e);};
  return {view,views,doc,win,send,parent,active:v=>active=v,charge:v=>charging=v,get cleared(){return cleared;},restore(){globalThis.document=old.document;globalThis.window=old.window;}};
}

test('precision first-person mouse turns incrementally without camera feedback, freezes on charge and preserves touch',()=>{
  for(const [kind,Game] of [['golf',GolfGame],['pool',PoolGame],['curling',CurlingGame],['petanca',PetancaGame]]) {
    const game=new Game();if(kind==='pool')game.stage='aim';
    const f=fixture(kind,game),angle=()=>kind==='petanca'?game.heading:game.angle;
    try {
      const start=angle();f.send('pointermove');f.send('pointermove',{clientX:440});const change=angle()-start;
      assert.ok(Math.abs(change)>.001,kind);
      f.view.render(game);f.send('pointermove',{clientX:440});assert.equal(angle(),start+change);
      f.send('pointermove',{clientX:480,shiftKey:true});assert.ok(Math.abs(angle()-start-change)<Math.abs(change)*.21);
      const locked=angle();f.charge(true);f.send('pointermove',{clientX:550});f.send('pointerdown');
      assert.equal(f.view.aimAt(400,300),null);assert.equal(angle(),locked);
      f.send('pointermove',{pointerType:'touch',clientX:40});assert.deepEqual(f.view.aimAt(40,30),{x:40,z:30});
      f.active(false);f.send('pointermove',{clientX:600});assert.equal(angle(),locked);
      f.views.setMode('top');assert.deepEqual(f.view.aimAt(40,30),{x:40,z:30});
    } finally {f.restore();}
  }
});

test('first-person look rotates movement and centre aim, supports locked deltas and cancels on unlock',()=>{
  const game=new PadelGame(),f=fixture('padel',game);
  try {
    const before=f.view.camera.getWorldDirection(new THREE.Vector3());
    f.send('pointermove');f.send('pointermove',{clientX:520,clientY:260});
    const after=f.view.camera.getWorldDirection(new THREE.Vector3());assert.ok(after.distanceTo(before)>.2);
    const walk=movement(0,-1,f.view.camera);assert.ok(walk.moveX>0);
    const a=f.view.aimAt(0,0),b=f.view.aimAt(800,600);assert.deepEqual(a,b);assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.z));
    f.view.canvas.requestPointerLock();const camera=f.view.camera.quaternion.clone();
    f.send('pointermove',{movementX:90,movementY:15});assert.ok(camera.angleTo(f.view.camera.quaternion)>.1);
    f.charge(true);const clears=f.cleared;f.doc.exitPointerLock();assert.ok(f.cleared>clears);
    f.active(false);const frozen=f.view.camera.quaternion.clone();f.send('pointermove',{clientX:100});assert.ok(frozen.equals(f.view.camera.quaternion));
    f.views.setMode('third');assert.equal(f.doc.pointerLockElement,null);
  } finally {f.restore();}
});
