import test from 'node:test';
import assert from 'node:assert/strict';
import { PoolGame, STEP, R, resolveShot } from '../pool/simulation.js';
const shot = overrides => ({first:1,legal:[1,2,3,4,5,6,7],pots:[],rail:true,scratch:false,called:2,breakRails:new Set(),...overrides});
const resolve = (s,extra={}) => resolveShot({turn:0,groups:['solids','stripes'],isBreak:false,shot:shot(s),...extra});
test('open table assigns groups only after a legal ordinary pot; break remains open', () => {
 const s={pots:[{id:10,pocket:0}],first:10,legal:[10]};
 assert.deepEqual(resolve(s,{groups:[null,null]}).groups,['stripes','solids']);
 assert.deepEqual(resolve(s,{groups:[null,null],isBreak:true}).groups,[null,null]);
 assert.deepEqual(resolve({...s,scratch:true},{groups:[null,null]}).groups,[null,null]);
});
test('own pot continues the turn; miss passes it; fouls award ball in hand', () => {
 assert.equal(resolve({pots:[{id:1,pocket:0}]}).turn,0);assert.equal(resolve({}).turn,1);
 for(const s of [{scratch:true},{first:null},{first:9},{rail:false}]) { const r=resolve(s);assert.equal(r.hand,true);assert.equal(r.turn,1); }
});
test('eight needs a cleared group, called pocket and no foul', () => {
 const pots=[{id:8,pocket:2}];assert.equal(resolve({first:8,legal:[8],pots}).winner,0);
 for(const s of [{first:8},{first:8,legal:[8],scratch:true},{first:8,legal:[8],called:3}]) assert.equal(resolve({...s,pots}).winner,1);
 // Clearing the final ordinary ball during the same stroke does not legalize the eight.
 assert.equal(resolve({pots:[{id:7,pocket:0},{id:8,pocket:2}],legal:[7],first:7}).winner,1);
});
test('eight on break is respotted; illegal break reracks; scratch gives hand', () => {
 const eight=resolve({pots:[{id:8,pocket:2}]},{isBreak:true});assert.equal(eight.respot,true);assert.equal(eight.winner,null);
 assert.equal(resolve({breakRails:new Set([1,2,3])},{isBreak:true}).rerack,true);
 assert.equal(resolve({breakRails:new Set([1,2,3,4])},{isBreak:true}).rerack,false);
 assert.equal(resolve({pots:[{id:1,pocket:0}],scratch:true},{isBreak:true}).hand,true);
});
test('ball placement rejects rails, pockets and overlapping balls', () => {
 const g=new PoolGame();g.stage='place';g.balls[0].dead=true;
 assert.equal(g.placeCue({x:2.4,z:0}),false);assert.equal(g.placeCue({x:g.balls[1].x,z:g.balls[1].z}),false);
 assert.equal(g.placeCue({x:.6,z:2}),true);assert.equal(g.stage,'aim');assert.equal(g.balls[0].dead,false);
});
test('high-speed pocket contact and cushion rebound use the actual physics', () => {
 const g=new PoolGame();g.shoot();for(const b of g.balls)b.dead=b.id!==0;
 Object.assign(g.balls[0],{x:2,z:0,vx:12,vz:0});for(let i=0;i<10;i++)g.physics(STEP);
 assert.equal(g.balls[0].dead,true);assert.equal(g.shot.scratch,true);
 const h=new PoolGame();h.shoot();for(const b of h.balls)b.dead=b.id!==0;Object.assign(h.balls[0],{x:2.25,z:2,vx:12,vz:0});h.physics(STEP);
 assert.ok(h.balls[0].vx<0);assert.ok(h.balls[0].x<=2.4-R);
});
test('pool preview is cached and shooting once cannot be repeated while rolling', () => {
 const g=new PoolGame();assert.equal(g.preview(),g.preview());g.angle+=.1;const p=g.preview();assert.equal(p,g.preview());
 assert.equal(g.shoot(.5),true);assert.equal(g.shoot(.9),false);assert.equal(g.shots,1);
});
test('seeded AI racks pot balls for both sides and finish by a legal called eight', () => {
 for(const seed of [17,42,128]){const g=new PoolGame({seed});for(let i=0;i<160000&&g.stage!=='over';i++)g.step(STEP,{autoplay:true});
 assert.equal(g.stage,'over');assert.ok(g.potted.every(n=>n>0));assert.match(g.message,/Eight in the called pocket/);assert.ok(g.shots>8);assert.ok(g.balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.z)));}
});
