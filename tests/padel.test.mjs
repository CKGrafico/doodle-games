import test from 'node:test';
import assert from 'node:assert/strict';
import {Score,Rally,serviceBoxValid,wallKind} from '../padel/rules.js';
import {PadelGame,FIXED_STEP} from '../padel/simulation.js';

test('service boxes alternate diagonally and include service lines',()=>{
  assert.ok(serviceBoxValid(-2,-6.95,0,2));assert.ok(serviceBoxValid(2,6.95,1,-2));
  assert.ok(!serviceBoxValid(2,-4,0,2));assert.ok(!serviceBoxValid(-2,-7.2,0,2));
});
test('a return can rebound off glass, but must be hit before bounce two',()=>{
  const rally=new Rally(0,2,2);assert.equal(rally.floor(-2,-5),null);
  assert.equal(rally.wall('glass',1),null);
  assert.equal(rally.strike(1,2),null);assert.equal(rally.floor(3,8),null);
  assert.equal(rally.wall('glass',0),null);
  assert.deepEqual(rally.floor(2,7),{winner:1,reason:'Second bounce'});
});
test('opponents’ wall before ground loses the point, own glass is allowed',()=>{
  const rally=new Rally(0,2,2);rally.isServe=false;
  assert.equal(rally.wall('glass',0),null);
  assert.equal(rally.wall('glass',1).winner,1);
  assert.equal(rally.wall('fence',0).winner,1);
});
test('serve may rebound off glass but not the fence',()=>{
  const rally=new Rally(0,2,2);rally.floor(-2,-5);
  assert.equal(rally.wall('glass',1),null);
  assert.equal(rally.wall('fence',1).fault,true);
  assert.equal(wallKind('x',1,-8),'glass');assert.equal(wallKind('x',1,-3),'fence');assert.equal(wallKind('z',3.5,-10),'fence');
});
test('serve receiver must wait for a bounce and the designated player receives',()=>{
  const rally=new Rally(0,2,2);assert.equal(rally.strike(1,2).winner,0);
  rally.floor(-2,-5);assert.equal(rally.strike(1,3).reason,'Wrong receiver');
  assert.equal(rally.strike(1,2),null);
});
test('net serve landing legally is a let, fence overrides let',()=>{
  const rally=new Rally(0,2,2);rally.netTouched=true;rally.floor(-2,-5);
  assert.equal(rally.strike(1,2).let,true);
  const fence=new Rally(0,2,2);fence.netTouched=true;fence.floor(-2,-5);
  assert.equal(fence.wall('fence',1).fault,true);
});
test('quick match uses deciding point and ends at three games',()=>{
  const score=new Score('quick');for(let i=0;i<3;i++){score.award(0);score.award(1);}
  assert.ok(score.decidingPoint);assert.equal(score.award(0).game,true);
  for(let i=0;i<8;i++)score.award(0);
  assert.deepEqual(score.games,[3,0]);assert.equal(score.winner,0);
});
test('one set preserves deuce and advantage, then wins by two games',()=>{
  const score=new Score('set');for(let i=0;i<3;i++){score.award(0);score.award(1);}
  score.award(0);assert.deepEqual(score.labels(),['AD','40']);
  score.award(1);assert.deepEqual(score.labels(),['40','40']);
  score.award(0);assert.ok(score.award(0).game);
  for(let i=0;i<20;i++)score.award(0);
  assert.equal(score.winner,0);assert.deepEqual(score.games,[6,0]);
});
test('all four players serve in order and tiebreak follows 1-2-2 service',()=>{
  const score=new Score('set');const servers=[];
  for(let game=0;game<12;game++){
    servers.push(score.server);for(let p=0;p<4;p++)score.award(game%2);
  }
  assert.deepEqual(servers.slice(0,4),[0,2,1,3]);assert.ok(score.tiebreak);
  const tb=[];for(let point=0;point<6;point++){tb.push(score.server);score.award(point%2);}
  assert.deepEqual(tb,[0,2,2,1,1,3]);
  for(let i=0;i<4;i++)score.award(0);
  assert.equal(score.winner,0);assert.deepEqual(score.games,[7,6]);
});
test('all four service positions launch legally after bouncing underarm',()=>{
  for(let n=0;n<8;n++){
    const game=new PadelGame({seed:50+n});game.score.gameNumber=Math.floor(n/2);game.score.points=[n%2,0];game.prepareServe();
    for(let t=0;t<4;t+=FIXED_STEP){
      game.step(FIXED_STEP,{shot:'drive',aim:game.aim});
      if(game.rally?.bounces>0)break;
    }
    assert.equal(game.serveAttempt,1,`unexpected fault at service ${n}`);
    assert.ok(game.rally?.bounces>0 || game.rallyHits>1,`serve never landed ${n}`);
  }
});
test('seeded full matches finish with legal, finite rallies at each difficulty',()=>{
  for(const difficulty of ['casual','club','pro']) {
    const game=new PadelGame({difficulty,assisted:true,seed:998});
    let hits=0,walls=0,maxRally=0,steps=0;
    for(;steps<120*900 && game.stage!=='over';steps++){
      const aim={x:Math.sin(game.time*.73)*3.9,z:-8.1};
      game.step(FIXED_STEP,{shot:steps%(120*9)<120*2?'lob':'drive',aim});
      for(const event of game.drainEvents()){if(event.type==='hit')hits++;if(event.type==='wall')walls++;}
      maxRally=Math.max(maxRally,game.rallyHits);
      if(steps%120===0){
        for(const value of Object.values(game.ball))assert.ok(Number.isFinite(value));
        for(const p of game.players){assert.ok(Math.abs(p.x)<=4.59);assert.ok(p.team===0?p.z>=.59:p.z<=-.59);}
      }
    }
    assert.equal(game.stage,'over',`${difficulty} match did not finish`);
    assert.ok(hits>25,`${difficulty} only ${hits} hits`);
    assert.ok(maxRally>=3,`${difficulty} rallies never developed`);
    console.log(`${difficulty}: ${Math.round(steps/120)} simulated seconds, ${hits} hits, ${walls} wall rebounds, best rally ${maxRally}, score ${game.score.games.join(':')}`);
  }
});
