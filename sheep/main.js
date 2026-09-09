import { SheepGame, LEVELS, STEP } from './simulation.js';
import { movement, wantsSprint, isEditing, installLifecycle } from '../shared/controls.js';
import { installStick, installTouchAim, observeSurface } from '../shared/touch.js';
import { Charge, installCharge } from '../shared/charge.js';
import { installViews } from '../shared/cameras.js';
const $=id=>document.getElementById(id), keys=new Set(), keyboard=new Charge();
const dialogs=[$('help-dialog'),$('pause-dialog')];
let game=new SheepGame(),view,frame,last=0,acc=0,power=0,stickValue={x:0,z:0},mouse,button,nextHud=0;
const active=()=>game.stage==='playing'&&!dialogs.some(d=>d.open);
const canBark=()=>active()&&game.barkCooldown===0;
const stick=installStick({element:$('joystick'),thumb:$('joystick-thumb'),active,change:value=>stickValue=value});
function clear(){keys.clear();keyboard.cancel();mouse?.cancel();button?.cancel();stick.clear();power=0;acc=0;}
const bestKey=()=>`doodle-sheep:${game.level}:${game.relaxed?'relaxed':'timed'}`;
function best(){try{return localStorage.getItem(bestKey())||'No best yet';}catch{return 'Best unavailable';}}
function saveBest(){if(game.stage!=='won')return;try{const old=Number(localStorage.getItem(bestKey()))||0;localStorage.setItem(bestKey(),String(Math.max(old,game.stars)));}catch{/* Optional storage. */}}
function sync(){
  const playing=game.stage!=='ready',ended=['won','lost'].includes(game.stage);
  $('lobby').hidden=playing;$('hud').hidden=!playing;$('controls').hidden=!playing;$('touch-controls').hidden=game.stage!=='playing';$('pause').hidden=game.stage!=='playing';$('result').hidden=!ended;
  document.body.classList.toggle('playing',playing);view?.setLobby(!playing);
  $('saved').textContent=game.saved+' / '+game.config.count+' home';$('clock').textContent=game.relaxed?'No rush':Math.ceil(Math.max(0,game.config.seconds-game.time))+' s';
  $('level-name').textContent=game.config.name;$('status').textContent=game.message;
  $('flock-status').textContent=`Save ${game.config.quota} to win · ${game.remaining} in the field · ${game.lost} lost`;
  $('finish').hidden=game.saved<game.config.quota||game.stage!=='playing';
  $('whistle').disabled=!active()||game.whistleCooldown>0;$('whistle').textContent=game.whistleCooldown?'WHISTLE '+Math.ceil(game.whistleCooldown):'WHISTLE · E';
  $('gate').hidden=game.level!==2;$('gate').disabled=!active()||Math.hypot(game.player.x-game.lever.x,game.player.z-game.lever.z)>3;
  $('bark').disabled=!canBark()&&!button?.charging;
  $('result-title').textContent=game.stage==='won'?'★'.repeat(game.stars)+' · Flock home!':'A woolly little setback.';
  $('result-detail').textContent=`${game.saved} rescued · ${game.lost} lost · ${game.time.toFixed(1)} seconds`;
  $('next').hidden=game.stage!=='won'||game.level===LEVELS.length-1;
  $('best').textContent='Best stars in this mode: '+best();
}
function start(level=Number($('level').value)){clear();dialogs.forEach(d=>d.close());game=new SheepGame({level,relaxed:$('pace').value==='relaxed'});game.start();sync();view.resize();$('court').focus({preventScroll:true});}
function fire(value){if(canBark())game.bark(value);power=0;}
const options={enabled:canBark,context:()=>game.context,fire,secondary:()=>{if(active())game.whistle();},progress:value=>power=value??0,
  cancelKey:e=>!['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code),allowConcurrent:e=>!!e.target.closest?.('#joystick')};
mouse=installCharge({canvas:$('court'),...options});button=installCharge({canvas:$('bark'),...options,allowTouch:true});
$('bark').onclick=e=>{if(e.detail===0)fire(.5);};
const aim=e=>{if(!view||!active())return;const point=view.aimAt(e.clientX,e.clientY);if(point)game.aim=point;};
$('court').addEventListener('pointermove',e=>{if(e.pointerType!=='touch')aim(e);});
$('court').addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')aim(e);});
installTouchAim({canvas:$('court'),active,aim});
for(const element of [$('court'),$('bark')])element.addEventListener('pointerdown',()=>keyboard.cancel(),true);
window.addEventListener('keydown',e=>{
  if(isEditing(e.target))return;
  if(e.code==='Escape'||e.code==='KeyP'){if(active())$('pause').click();return;}
  if(e.key==='?'){$('help').click();return;}if(!active())return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);
  if(!e.repeat&&e.code==='Space'&&canBark()){mouse.cancel();button.cancel();keyboard.begin(performance.now(),game.context);}
  if(!e.repeat&&e.code==='KeyE')game.whistle();if(!e.repeat&&e.code==='KeyQ')game.openGate();
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space'){const value=keyboard.release(performance.now(),canBark()?game.context:Symbol());if(value!==null)fire(value);}});
function loop(now){
  frame=requestAnimationFrame(loop);const dt=Math.min((now-last)/1000||0,.05);last=now;mouse.update(now);button.update(now);
  if(keyboard.state){if(!canBark()){keyboard.cancel();power=0;}else power=keyboard.power(now);}
  if(active()){
    const x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+stickValue.x;
    const z=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))+stickValue.z;
    const input={...movement(x,z,view.camera),sprint:wantsSprint(keys,stickValue),aim:game.aim};
    acc=Math.min(acc+dt,.1);while(acc>=STEP){game.step(STEP,input);acc-=STEP;}
    if(game.stage!=='playing'){clear();saveBest();}
  }else acc=0;
  game.drainEvents();$('power').value=power;
  if(now>=nextHud){sync();nextHud=now+100;}view.render(game,dt,now/1000);
}
$('start').onclick=()=>start();$('again').onclick=()=>start(game.level);$('restart').onclick=()=>start(game.level);$('next').onclick=()=>start(game.level+1);
$('whistle').onclick=()=>{if(active())game.whistle();};$('gate').onclick=()=>{if(active())game.openGate();};
$('finish').onclick=()=>{if(active()&&game.finish()){clear();saveBest();sync();}};
$('help').onclick=()=>{clear();$('help-dialog').showModal();};$('pause').onclick=()=>{if(active()){clear();$('pause-dialog').showModal();}};
$('resume').onclick=()=>$('pause-dialog').close();$('quit').onclick=()=>{clear();dialogs.forEach(d=>d.close());game=new SheepGame({level:Number($('level').value),relaxed:$('pace').value==='relaxed'});sync();};
for(const id of ['level','pace'])$(id).onchange=()=>{game=new SheepGame({level:Number($('level').value),relaxed:$('pace').value==='relaxed'});sync();};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());$('reload').onclick=()=>location.reload();
function fatal(error){clear();cancelAnimationFrame(frame);game.stage='error';$('error').hidden=false;$('start').disabled=true;console.error(error);}
installLifecycle({canvas:$('court'),dialogs,clear,active,pause:()=>$('pause').click(),fatal});observeSurface($('court'),()=>view?.resize());
try{const {SheepView}=await import('./render.js');await document.fonts.ready;view=new SheepView($('court'));installViews(view,'sheep',clear,{active});$('start').disabled=false;sync();frame=requestAnimationFrame(loop);}catch(error){fatal(error);}
