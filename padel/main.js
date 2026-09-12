import { installViews } from '../shared/cameras.js';
import { installStick } from '../shared/touch.js';
import { sportsMouse } from '../shared/sports-mouse.js';
let mouse;
import { movement, isEditing, ActionQueue, wantsSprint } from '../shared/controls.js';
import { PadelGame, FIXED_STEP } from './simulation.js';
import { PadelClock, PadelPresentation } from './feel.js';
import { installShotButtons } from './input.js';
import { installFeelLab } from './diagnostics.js';

const $=id=>document.getElementById(id);
let view,game=new PadelGame(),playing=false,frame=0,previous=0,hudPrevious='',noticeUntil=0;
let soundOn=false,audioContext=null,bufferedShot=null,touchShot=null,moveTouch={x:0,z:0},touchShots,lab;
const clock = new PadelClock(FIXED_STEP), presentation = new PadelPresentation(game);
const switches=new ActionQueue();
const keys=new Set(),touch=matchMedia('(pointer: coarse)').matches;
const dialogs=[$('help-dialog'),$('pause-dialog'),$('result-dialog')];
const isPaused=()=>dialogs.some(dialog=>dialog.open);
let lookSensitivity = 1;
try {
  lookSensitivity = Math.max(.3, Math.min(2, Number(localStorage.getItem('padel-look-sensitivity')) || 1));
  soundOn = localStorage.getItem('padel-sound') === 'true';
} catch { /* Device preferences are optional. */ }
$('look-sensitivity').value = lookSensitivity;
$('sound').textContent = soundOn ? 'Sound on' : 'Sound off';
$('sound').setAttribute('aria-pressed', String(soundOn));

function beep(kind) {
  if(!soundOn)return;
  try {
    audioContext??=new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume();
    const osc=audioContext.createOscillator(),gain=audioContext.createGain();
    const now=audioContext.currentTime;
    const notes={hit:[540,210,.07],volley:[720,310,.045],smash:[390,120,.09],lob:[620,420,.08],bounce:[210,95,.07],wall:[900,290,.13],net:[100,55,.11],point:[640,950,.24],placement:[850,1250,.16],fault:[180,85,.22]};
    const [start,end,length]=notes[kind]??notes.hit;
    osc.type=kind==='wall'?'triangle':'sine';osc.frequency.setValueAtTime(start,now);osc.frequency.exponentialRampToValueAtTime(end,now+length);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.1,now+.006);gain.gain.exponentialRampToValueAtTime(.0001,now+length);
    osc.connect(gain);gain.connect(audioContext.destination);osc.start(now);osc.stop(now+length+.02);
  }catch{soundOn=false;$('sound').textContent='Sound unavailable';$('sound').setAttribute('aria-pressed','false');}
}

function clearInput(){touchStick?.clear();touchShots?.clear();mouse?.cancel();switches.clear();keys.clear();bufferedShot=null;touchShot=null;moveTouch={x:0,z:0};$('joystick-thumb').style.transform='';clock.reset();presentation.capture(game);previous=performance.now();}
function queueShot(kind) { bufferedShot = {kind, hit:game.lastHitTime, until:game.time+.22}; }
function applyPlayingUI() {
  document.body.classList.toggle('playing',playing);
  document.body.classList.toggle('practicing',playing&&game.mode==='practice');
  for(const id of ['lobby','court-note','lobby-footer'])$(id).hidden=playing;
  for(const id of ['hud','controls','pause','player-label'])$(id).hidden=!playing;
  $('touch-controls').hidden=!playing||!(touch||innerWidth<650);
  $('callout').hidden=!playing;view.setLobby(!playing);view.resize();
  $('practice-tools').hidden=!playing||game.mode!=='practice';
}
function startMatch({ practiceSeed, profile } = {}) {
  clearInput();for(const dialog of dialogs)if(dialog.open)dialog.close();
  game=new PadelGame({mode:$('mode').value,difficulty:$('difficulty').value,assisted:$('assist').checked,seed:practiceSeed??Date.now()%2147483647,motionProfile:profile??lab?.profile??'responsive'});
  presentation.capture(game);clock.reset();
  playing=true;hudPrevious='';applyPlayingUI();updateAssist();updateHUD(true);
  $('court').setAttribute('tabindex','0');$('court').focus({preventScroll:true});
  if(soundOn)beep('hit');
}
function quit() {for(const dialog of dialogs)if(dialog.open)dialog.close();playing=false;clearInput();game=new PadelGame();applyPlayingUI();$('start').focus();}
function pause() {if(!playing||game.stage==='over')return;clearInput();if($('pause-dialog').open)$('pause-dialog').close();else if(!isPaused())$('pause-dialog').showModal();}
function updateAssist(){$('assist-toggle').textContent=`Movement help: ${game.assisted?'on':'off'}`;$('assist-toggle').setAttribute('aria-pressed',String(game.assisted));}
function showHelp(){clearInput();$('help-dialog').showModal();}
function updateHUD(force=false) {
  const snapshot=[...game.score.points,...game.score.games,game.stage,game.message,game.rallyHits,game.serveAttempt,game.score.server,game.score.tiebreak,game.shotHint,game.bestRally,game.practice.placements].join('|');
  if(!force&&snapshot===hudPrevious)return;hudPrevious=snapshot;
  const labels=game.mode==='practice'?game.score.points.map(String):game.score.labels();
  $('your-points').textContent=labels[0];$('their-points').textContent=labels[1];
  $('your-games').textContent=game.score.games[0];$('their-games').textContent=game.score.games[1];
  $('match-mode').textContent=game.score.tiebreak?'TIE-BREAK':{quick:'FIRST TO 3 GAMES',set:'ONE SET',practice:'WARM-UP'}[game.mode];
  $('serve-label').textContent=game.score.decidingPoint?'DECIDING POINT':Math.floor(game.score.server/2)===0?'YOUR SERVE':'DISTRICT SERVES';
  $('rally-count').textContent=game.rallyHits;
  $('contact-hint').textContent=game.stage==='rally'?game.shotHint:'Hold Hit to prepare · aim for open court';
  $('practice-progress').textContent=`${game.practice.placements} targets · best rally ${game.bestRally}`;
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
    if(['hit','bounce','wall','net','point','fault','placement'].includes(event.type))beep(event.type==='hit'?event.kind:event.type);
    if(event.type==='placement'){$('shot-notice').textContent='Right on the mark!';$('shot-notice').hidden=false;noticeUntil=performance.now()+1000;}
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
  if (bufferedShot && (game.lastHitTime!==bufferedShot.hit||game.time>bufferedShot.until)) bufferedShot=null;
  const direct=touchShot||(keys.has('KeyE')?'lob':keys.has('KeyQ')?'smash':keys.has('Space')?'drive':null);
  return {moveX,moveZ,sprint:wantsSprint(keys,moveTouch),
    shot:direct||release?.kind||bufferedShot?.kind, power:direct ? .65 : release?.power,
    preparing:mouse?.charging?mouse.kind:null,
    switch:switches.take()==='switch',aim:release?.aim??game.aim};
}
function animate(now) {
  frame=requestAnimationFrame(animate);mouse?.update(now);
  const interval=previous?Math.max(0,(now-previous)/1000):0;previous=now;
  const dt=Math.min(interval,.06), active=playing&&!isPaused();
  const simulationStart=performance.now();
  let result={alpha:1,steps:0,dropped:0};
  if(active) {
    result=clock.advance(interval,game,getInput,presentation);
    processEvents();updateHUD();
  }else {clock.reset();presentation.capture(game);}
  const simulationEnd=performance.now();
  const state=presentation.sample(game,lab?.profile==='classic'?1:result.alpha);
  const label=view.render(game,playing&&!active?0:dt,playing?game.time:now/1000,state);
  const renderEnd=performance.now();
  if(active)lab?.record({interval,simulation:simulationEnd-simulationStart,render:renderEnd-simulationEnd,discarded:result.dropped,draws:view.renderer.info.render.calls,triangles:view.renderer.info.render.triangles},now);
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
$('sound').addEventListener('click',()=>{soundOn=!soundOn;$('sound').textContent=soundOn?'Sound on':'Sound off';$('sound').setAttribute('aria-pressed',String(soundOn));try{localStorage.setItem('padel-sound',String(soundOn));}catch{}if(soundOn)beep('hit');});
$('look-sensitivity').addEventListener('input',()=>{lookSensitivity=Number($('look-sensitivity').value);try{localStorage.setItem('padel-look-sensitivity',String(lookSensitivity));}catch{}});
function nextPracticeBall() { clearInput(); if(game.retryPractice()){presentation.capture(game);processEvents();updateHUD(true);$('court').focus();} }
$('next-ball').addEventListener('click',nextPracticeBall);
$('camera').addEventListener('click',()=>{if(!view)return;view.mode=view.mode==='raised'?'end':'raised';$('camera').textContent=`Camera: ${view.mode==='raised'?'raised':'end court'}`;$('court').focus();});
$('assist-toggle').addEventListener('click',()=>{game.assisted=!game.assisted;updateAssist();$('court').focus();});
window.addEventListener('resize',()=>{if(view){view.resize();$('touch-controls').hidden=!playing||!(touch||innerWidth<650);}});
window.addEventListener('keydown',event=>{
  if(isEditing(event.target))return;
  if(event.key==='?'&&!isPaused()){event.preventDefault();showHelp();return;}
  if(event.code==='Escape'||event.code==='KeyP'){if(!isPaused()){event.preventDefault();pause();}return;}
  if(!playing||isPaused())return;
  if(event.code==='KeyR'&&game.mode==='practice'&&!event.repeat){event.preventDefault();nextPracticeBall();return;}
  if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
  if(event.code==='Tab'){if(!event.repeat)switches.push('switch');return;}
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
$('court').addEventListener('contextmenu',event=>event.preventDefault());
touchShots=installShotButtons(document.querySelectorAll('[data-shot]'),{active:()=>playing&&!isPaused(),focus:()=>$('court').focus({preventScroll:true}),change:kind=>touchShot=kind,tap:queueShot});
$('switch-player').addEventListener('pointerdown',event=>{if(playing&&!isPaused()){event.preventDefault();switches.push('switch');}});
$('switch-player').addEventListener('click',event=>{if(event.detail===0&&playing&&!isPaused())switches.push('switch');});
const touchStick = installStick({ element: $('joystick'), thumb: $('joystick-thumb'), active: () => playing && !isPaused(), change: value => { moveTouch = value; } });
$('court').addEventListener('webglcontextlost',event=>{event.preventDefault();fatal(new Error('WebGL context lost'));});

mouse=sportsMouse({canvas:$('court'),game:()=>game,active:()=>playing&&!isPaused()&&['ready','rally'].includes(game.stage),context:g=>g.stage+':'+g.lastHitTime,racket:true,choices:[['drive','Drive'],['lob','Lob'],['smash','Smash']],secondary:()=>queueShot('lob')});
lab=installFeelLab({game:()=>game,reset:profile=>{if(!view)return;$('mode').value='practice';startMatch({practiceSeed:4187,profile});}});

try {
  const {CourtView}=await import('./render.js');
  await document.fonts.ready;
  view=new CourtView($('court')); installViews(view, 'padel', clearInput, { active: () => playing && !isPaused() && game.stage !== 'over',touchLook:true,sensitivity:()=>lookSensitivity });view.setLobby(true);requestAnimationFrame(animate);
  new ResizeObserver(()=>view.resize()).observe($('arena'));
}catch(error){fatal(error);}
