import test from 'node:test';import assert from 'node:assert/strict';import {GolfGame,HOLES,lieAt,scoreName,STEP} from '../golf/simulation.js';
test('course contains nine designed holes',()=>{assert.equal(HOLES.length,9);assert.equal(HOLES.reduce((n,h)=>n+h.par,0),35)});
test('terrain identifies green, sand, and water',()=>{const h=HOLES[2];assert.equal(lieAt(h,h.cup),'green');assert.equal(lieAt(h,{x:0,z:-18}),'water');assert.equal(lieAt(HOLES[0],{x:10,z:-38}),'bunker')});
test('a golf shot comes to a playable outcome',()=>{const g=new GolfGame({holes:3,wind:'calm'});g.club='iron';g.power=.7;g.shoot();for(let i=0;i<4000&&g.stage==='flight';i++)g.step(STEP);assert.ok(['aim','holed'].includes(g.stage));assert.equal(g.strokes,1)});
test('score names follow par',()=>{assert.equal(scoreName(3,4),'Birdie!');assert.equal(scoreName(4,4),'Par. Nicely done.')});
