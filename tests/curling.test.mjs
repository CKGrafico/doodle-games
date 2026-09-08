import test from 'node:test';
import assert from 'node:assert/strict';
import { CurlingGame, STEP, R, SHEET, scoreEnd, trajectory } from '../curling/simulation.js';
import { collide } from '../shared/discs.js';
const stone = (team, x, z = SHEET.house) => ({ team, x, z, r: R, vx: 0, vz: 0, dead: false });
test('curling scores only closer stones touching the house, with ties and blanks', () => {
  assert.deepEqual(scoreEnd([stone(0,.2),stone(0,.4),stone(1,.6),stone(0,1)]), {team:0,points:2});
  assert.equal(scoreEnd([stone(1,SHEET.houseR+R-.001)]).points,1);
  assert.equal(scoreEnd([stone(0,0),stone(1,0)]).points,0);
  assert.equal(scoreEnd([stone(0,2.2)]).points,0);
});
test('sweeping increases travel and reduces curl, while power increases delivery distance', () => {
  const normal=trajectory(.6,0,1).end,swept=trajectory(.6,0,1,true).end,soft=trajectory(.4,0,1).end;
  assert.ok(swept.z<normal.z&&normal.z<soft.z);assert.ok(Math.abs(swept.x)<Math.abs(normal.x));
  const left=trajectory(.6,0,-1).end;assert.ok(Math.abs(left.x+normal.x)<1e-8);
});
test('stones transfer momentum without creating energy', () => {
  const a={...stone(0,0),vx:3},b=stone(1,.43);assert.ok(collide(a,b,.9));assert.ok(b.vx>2.8);assert.ok(a.vx*a.vx+b.vx*b.vx<=9);
});
test('short deliveries are removed and alternate the turn', () => {
  const g=new CurlingGame({local:true});g.shoot(.05);
  for(let i=0;i<2000&&g.stage==='rolling';i++)g.step(STEP);
  assert.equal(g.active.dead,true);assert.equal(g.stage,'aim');assert.equal(g.turn,0);assert.equal(g.remaining[1],7);
});
test('an early opponent guard removal restores the position and removes the shooter', () => {
  const g=new CurlingGame({local:true});g.turn=0;g.stones=[{...stone(1,.3,-3),id:90}];g.shoot(.8);g.stones[0].dead=true;g.finishShot();
  assert.equal(g.stones[0].dead,false);assert.equal(g.stones[0].x,.3);assert.equal(g.active.dead,true);
});
test('hammer changes after a score and stays after a blank; tied last ends continue', () => {
  const g=new CurlingGame({ends:1});g.turn=0;g.shoot();g.remaining=[0,0];g.active.z=SHEET.house;g.active.x=0;g.finishShot();
  assert.deepEqual(g.scores,[1,0]);assert.equal(g.hammer,1);assert.equal(g.stage,'over');
  const blank=new CurlingGame({ends:1});blank.shoot();blank.remaining=[0,0];blank.active.dead=true;blank.finishShot();assert.equal(blank.stage,'end');assert.equal(blank.hammer,0);blank.nextEnd();assert.equal(blank.endNumber,2);
});
test('seeded curling matches finish real ends with scoring and finite stones', () => {
  for(const seed of [17,42]){
    const g=new CurlingGame({ends:3,seed});
    for(let i=0;i<120000&&g.stage!=='over';i++){g.step(STEP,{autoplay:true});if(g.stage==='end')g.nextEnd();}
    assert.equal(g.stage,'over');assert.ok(g.shots>=48);assert.ok(g.scores.some(n=>n>0));assert.ok(g.stones.every(s=>Number.isFinite(s.x)&&Number.isFinite(s.z)));
  }
});
