import test from 'node:test';
import assert from 'node:assert/strict';
import { stickVector, installStick } from '../shared/touch.js';
import { PadelGame } from '../padel/simulation.js';
import { FootballGame } from '../football/simulation.js';
import { WaterPoloGame } from '../waterpolo/simulation.js';
import { PickleballGame } from '../pickleball/simulation.js';

test('partial stick movement produces slower real player motion in every movement sport',()=>{
  for(const Game of [PadelGame,FootballGame,WaterPoloGame,PickleballGame]){
    const distances=[];
    for(const strength of [.25,1]){
      const g=new Game({assisted:false});if(Game===PickleballGame)g.serve();
      const p=g.players[g.controlled];p.x=0;
      for(let i=0;i<30;i++)g.updatePlayers(1/120,{moveX:strength,moveZ:0});
      distances.push(p.x);
    }
    assert.ok(distances[0]>0&&distances[1]>distances[0]*1.5,Game.name);
  }
});

test('analogue stick has a stable centre, proportional speed and bounded diagonals', () => {
  assert.deepEqual(stickVector(.05,.05), {x:0,z:0});
  assert.ok(stickVector(.3,0).x < stickVector(.7,0).x);
  assert.ok(Math.abs(Math.hypot(...Object.values(stickVector(2,2))) - 1) < 1e-10);
});
test('a second finger cannot steal the stick and cancellation stops movement', () => {
  const oldWindow=globalThis.window, oldDocument=globalThis.document;
  globalThis.window=new EventTarget(); globalThis.document=new EventTarget();
  const element=new EventTarget(), thumb={style:{} }; let value, captured, active=true;
  element.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
  element.setPointerCapture=id=>captured=id; element.hasPointerCapture=id=>captured===id;
  element.releasePointerCapture=()=>captured=null;
  const send=(type,id,x=84)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:id,button:0,clientX:x,clientY:50});element.dispatchEvent(e);};
  try {
    const stick=installStick({element,thumb,active:()=>active,change:v=>value=v});
    send('pointerdown',1); assert.equal(value.x,1);
    send('pointerdown',2,16); send('pointermove',2,16); assert.equal(value.x,1);
    send('pointerup',2); assert.equal(value.x,1);
    send('pointercancel',1); assert.deepEqual(value,{x:0,z:0});
    send('pointerdown',3); stick.clear(); send('pointermove',3); assert.equal(value.x,0);
    active=false; send('pointerdown',4); assert.equal(value.x,0);
  } finally {globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
