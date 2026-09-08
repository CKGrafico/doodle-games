import { sportsMouse } from '../shared/sports-mouse.js';
let mouse;
import { movement, isEditing, ActionQueue, wantsSprint } from '../shared/controls.js';
import { PadelGame, FIXED_STEP } from './simulation.js';

const $=id=>document.getElementById(id);
let view,game=new PadelGame(),playing=false,frame=0,previous=0,accumulator=0,hudPrevious='',noticeUntil=0;
let soundOn=false,audioContext=null,pointerShot=null,touchShot=null,moveTouch={x:0,z:0};
const switches=new ActionQueue();
const keys=new Set(),touch=matchMedia('(pointer: coarse)').matches;
const dialogs=[$('help-dialog'),$('pause-dialog'),$('result-dialog')];
const isPaused=()=>dialogs.some(dialog=>dialog.open);

function beep(kind) {
  if(!soundOn)return;
  try {
    audioContext??=new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume();
    const osc=audioContext.createOscillator(),gain=audioContext.createGain();
    const now=audioContext.currentTime;
    const notes={hit:[540,210,.07],bounce:[210,95,.07],wall:[900,290,.13],net:[100,55,.11],point:[640,950,.24],fault:[180,85,.22]};
    const [start,end,length]=notes[kind]??notes.hit;
    osc.type=kind==='wall'?'triangle':'sine';osc.frequency.setValueAtTime(start,now);osc.frequency.exponentialRampToValueAtTime(end,now+length);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.1,now+.006);gain.gain.exponentialRampToValueAtTime(.0001,now+length);
    osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+length+.02);
  }catch{soundOn=false;$('sound').textContent='Sound unavailable';$('sound').setAttribute('aria-pressed','false');}
}

function clearInput(){mouse?.cancel();switches.clear();keys.clear();pointerShot=null;touchShot=null;moveTouch={x:0,z:0};$('joystick-thumb').style.transform='';}
function applyPlayingUI() {
  document.body.classList.toggle('playing',playing);
  for(const id of ['lobby','court-note','lobby-footer'])$(id).hidden=playing;
  for(const id of ['hud','controls','pause','player-label'])$(id).hidden=!playing;
  $('touch-controls').hidden=!playing||!(touch||innerWidth<650);
  $('callout').hidden=!playing;view.setLobby(!playing);
}
function startMatch() {
  clearInput();for(const dialog of dialogs)if(dialog.open)dialog.close();
  game=new PadelGame({mode:$('mode').value,difficulty:$('difficulty').value,assisted:$('assist').checked,seed:Date.now()%2147483647});
  playing=true;hudPrevious='';accumulator=0;applyPlayingUI();updateAssist();updateHUD(true);
  $('court').setAttribute('tabindex','0');$('court').focus({preventScroll:true});
  if(soundOn)beep('hit');
}
function quit() {for(const dialog of dialogs)if(dialog.open)dialog.close();playing=false;clearInput();game=new PadelGame();applyPlayingUI();$('start').focus();}
function pause() {if(!playing||game.stage==='over')return;clearInput();if($('pause-dialog').open)$('pause-dialog').close();else if(!isPaused())$('pause-dialog').showModal();}
function updateAssist(){$('assist-toggle').textContent=`Movement help: ${game.assisted?'on':'off'}`;$('assist-toggle').setAttribute('aria-pressed',String(game.assisted));}
function showHelp(){clearInput();$('help-dialog').showModal();}
function updateHUD(force=false) {
  const snapshot=[...game.score.points,...game.score.games,game.stage,game.message,game.rallyHits,game.serveAttempt,game.score.server,game.score.tiebreak].join('|');
  if(!force&&snapshot===hudPrevious)return;hudPrevious=snapshot;
  const labels=game.mode==='practice'?game.score.points.map(String):game.score.labels();
  $('your-points').textContent=labels[0];$('their-points').textContent=labels[1];
  $('your-games').textContent=game.score.games[0];$('their-games').textContent=game.score.games[1];
  $('match-mode').textContent=game.score.tiebreak?'TIE-BREAK':{quick:'FIRST TO 3 GAMES',set:'ONE SET',practice:'WARM-UP'}[game.mode];
  $('serve-label').textContent=game.score.decidingPoint?'DECIDING POINT':Math.floor(game.score.server/2)===0?'YOUR SERVE':'DISTRICT SERVES';
  $('rally-count').textContent=game.rallyHits;
  $('callout').hidden=!playing||!['ready','between'].includes(game.stage);
  if(game.stage==='ready') {
    $('callout-title').textContent=game.message;
    $('callout-detail').textContent=Math.floor(game.score.server/2)===0?'Press Space or tap Hit':'Get ready to return';
  }else if(game.stage==='between') {
    $('callout-title').textContent=game.message;
    $('callout-detail').textContent=game.serveAttempt===2?'One more chance':game.mode==='practice'?'Next rally coming up':'Next point coming up';
  }
}
function processEvents(){
  for(const event of game.drainEvents()) {
    view.effect(event);
    if(['hit','bounce','wall','net','point','fault'].includes(event.type))beep(event.type);
    if(event.type==='wall-return'){$('shot-notice').textContent='Off the glass!';$('shot-notice').hidden=false;noticeUntil=performance.now()+1150;}
    if(event.type==='hit' && event.kind==='smash'){$('shot-notice').textContent='¡SMASH!';$('shot-notice').hidden=false;noticeUntil=performance.now()+900;}
    if(event.type==='point' && event.match) {
      clearInput();$('result-title').textContent=event.winner===0?'The district is yours.':'A rematch, perhaps?';
      $('result-score').textContent=game.score.games.join(' : ');
      $('result-stats').textContent=`Longest rally: ${game.bestRally} shots · ${game.wallReturns} returns off the glass`;
      $('result-dialog').showModal();
    }
  }
}
function getInput() {
  let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+moveTouch.x;
  let z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+moveTouch.z;
  // Map screen-relative movement onto the court, including the angled camera.
  const {moveX,moveZ}=movement(x,z,view.camera); const release=mouse?.take();
  return {moveX,moveZ,sprint:wantsSprint(keys,moveTouch),
    shot:touchShot||pointerShot||(keys.has('KeyE')?'lob':keys.has('KeyQ')?'smash':keys.has('Space')?'drive':release?.kind??null),power:release?.power,
    switch:keys.has('Tab')||switches.take()==='switch',aim:release?.aim??game.aim};
}
function animate(now) {
  frame=requestAnimationFrame(animate);mouse?.update(now);
  const dt=Math.min((now-previous)/1000||0,.06);previous=now;
  if(playing&&!isPaused()) {
    accumulator=Math.min(accumulator+dt,FIXED_STEP*8);
    while(accumulator>=FIXED_STEP){game.step(FIXED_STEP,getInput());accumulator-=FIXED_STEP;}
    processEvents();updateHUD();
  }else accumulator=0;
  const label=view.render(game,dt,now/1000);
  if(playing){$('player-label').style.left=label.x+'px';$('player-label').style.top=label.y+'px';}
  if(now>noticeUntil)$('shot-notice').hidden=true;
}
function fatal(error) {
  playing=false;clearInput();
  if(frame)cancelAnimationFrame(frame);
  $('error').hidden=false;$('start').disabled=true;
  $('error-text').textContent=/WebGL|context/i.test(error?.message||'')?'Enable graphics acceleration in your browser, then reload to play.':'The court could not load. Reload to try again.';
  console.error(error);
}

$('start').addEventListener('click',()=>{if(view)startMatch();});
$('restart').addEventListener('click',startMatch);$('rematch').addEventListener('click',startMatch);
$('quit').addEventListener('click',quit);$('result-quit').addEventListener('click',quit);
$('pause').addEventListener('click',pause);$('resume').addEventListener('click',()=>{$('pause-dialog').close();clearInput();$('court').focus();});
$('help').addEventListener('click',showHelp);$('reload').addEventListener('click',()=>location.reload());
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>$(button.dataset.close).close());
for(const dialog of dialogs)dialog.addEventListener('close',clearInput);
$('sound').addEventListener('click',()=>{soundOn=!soundOn;$('sound').textContent=soundOn?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(soundOn));if(soundOn)beep('hit');});
$('camera').addEventListener('click',()=>{if(!view)return;view.mode=view.mode==='raised'?'end':'raised';$('camera').textContent=`Camera: ${view.mode==='raised'?'raised':'end court'}`;$('court').focus();});
$('assist-toggle').addEventListener('click',()=>{game.assisted=!game.assisted;updateAssist();$('court').focus();});
window.addEventListener('resize',()=>{if(view){view.resize();$('touch-controls').hidden=!playing||!(touch||innerWidth<650);}});
window.addEventListener('keydown',event=>{
  if(isEditing(event.target))return;
  if(event.key==='?'&&!isPaused()){event.preventDefault();showHelp();return;}
  if(event.code==='Escape'||event.code==='KeyP'){if(!isPaused()){event.preventDefault();pause();}return;}
  if(!playing||isPaused())return;
  if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
  keys.add(event.code);
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{clearInput();if(playing&&!isPaused())pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(playing&&!isPaused())pause();}});
$('court').addEventListener('pointermove',event=>{if(!view||!playing||isPaused()||event.pointerType==='touch')return;const aim=view.aimAt(event.clientX,event.clientY);if(aim)game.aim=aim;});
$('court').addEventListener('pointerdown',event=>{
  if(!view||!playing||isPaused())return;
  event.preventDefault();$('court').focus();const aim=view.aimAt(event.clientX,event.clientY);if(aim)game.aim=aim;

});
window.addEventListener('pointerup',()=>{pointerShot=null;});
window.addEventListener('pointercancel',()=>{pointerShot=null;});
$('court').addEventListener('contextmenu',event=>event.preventDefault());
for(const button of document.querySelectorAll('[data-shot]')){
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);touchShot=button.dataset.shot;});
  const release=()=>{if(touchShot===button.dataset.shot)touchShot=null;};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
}
$('switch-player').addEventListener('pointerdown',event=>{if(playing&&!isPaused()){event.preventDefault();switches.push('switch');}});
let joystickId=null;
function joystickMove(event){
  if(event.pointerId!==joystickId)return;
  const rect=$('joystick').getBoundingClientRect(),radius=rect.width*.34;
  let x=(event.clientX-rect.left-rect.width/2)/radius,z=(event.clientY-rect.top-rect.height/2)/radius;
  const mag=Math.max(1,Math.hypot(x,z));x/=mag;z/=mag;
  moveTouch={x,z};$('joystick-thumb').style.transform=`translate(${x*radius}px,${z*radius}px)`;
}
$('joystick').addEventListener('pointerdown',event=>{event.preventDefault();joystickId=event.pointerId;$('joystick').setPointerCapture(event.pointerId);joystickMove(event);});
$('joystick').addEventListener('pointermove',joystickMove);
for(const name of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(name,event=>{if(event.pointerId===joystickId){joystickId=null;moveTouch={x:0,z:0};$('joystick-thumb').style.transform='';}});
$('court').addEventListener('webglcontextlost',event=>{event.preventDefault();fatal(new Error('WebGL context lost'));});

mouse=sportsMouse({canvas:$('court'),game:()=>game,active:()=>playing&&!isPaused()&&['ready','rally'].includes(game.stage),context:g=>g.stage+':'+g.lastHitTime,racket:true,choices:[['drive','Drive'],['lob','Lob'],['smash','Smash']],secondary:()=>{pointerShot='lob';setTimeout(()=>pointerShot=null,160)}});

try {
  const {CourtView}=await import('./render.js');
  await document.fonts.ready;
  view=new CourtView($('court'));view.setLobby(true);requestAnimationFrame(animate);
}catch(error){fatal(error);}
