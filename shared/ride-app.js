import { isEditing } from './controls.js';
import { installStick, observeSurface } from './touch.js';
import { Charge, installCharge } from './charge.js';
const $=id=>document.getElementById(id);
export async function bootRide({Game,View,installLifecycle}){
  let game=new Game(),view,frame,last=0,acc=0,stickValue=0,mouseSteer=0,braking=false,brakePointer=null;
  let mouse,button,power=0;const keyboard=new Charge(),keys=new Set();
  const dialogs=[$('help-dialog'),$('pause-dialog')];
  const active=()=>game.stage==='riding'&&!dialogs.some(d=>d.open);
  const clear=()=>{keys.clear();keyboard.cancel();mouse?.cancel();button?.cancel();stick.clear();mouseSteer=0;braking=false;brakePointer=null;power=0;acc=0;};
  const fatal=error=>{clear();cancelAnimationFrame(frame);$('error').hidden=false;$('start').disabled=true;console.error(error);};
  const stick=installStick({element:$('joystick'),thumb:$('joystick-thumb'),active,change:value=>stickValue=value.x});
  function sync(){
    $('lobby').hidden=game.stage!=='ready';$('hud').hidden=game.stage==='ready';$('touch-controls').hidden=game.stage!=='riding';$('pause').hidden=game.stage!=='riding';
    $('result').hidden=game.stage!=='finished';document.body.classList.toggle('playing',game.stage!=='ready');
    $('status').textContent=game.message;$('speed').textContent=Math.round(game.speed*3.6)+' km/h';
    $('score').textContent=game.kind==='surf'?Math.round(game.total)+' pts':game.total.toFixed(1)+' s';
    $('detail').textContent=game.kind==='surf'?`Wave ${game.wave}/3 · ${Math.max(0,25-game.waveTime).toFixed(0)} s · Flow ×${game.combo}`:`${game.passed}/20 gates · ${Math.round(game.z)}/850 m · +${game.penalty}s`;
    $('energy').value=game.energy;$('balance').value=game.balance;$('power').value=power;
    $('finish-score').textContent=game.kind==='surf'?`Best two: ${Math.round(game.total)} points`:`${game.total.toFixed(2)} s · ${game.passed}/20 gates`;
    $('action').disabled=!active()||!!game.air||!!game.recovery||game.energy<.2;
    $('brake').setAttribute('aria-pressed',String(braking||keys.has('ArrowDown')||keys.has('KeyS')));
  }
  function start(){clear();dialogs.forEach(d=>d.close());game=new Game();game.start();sync();view?.resize();$('court').focus({preventScroll:true});}
  function loop(now){
    frame=requestAnimationFrame(loop);const dt=Math.min((now-last)/1000||0,.05);last=now;
    mouse.update(now);button.update(now);if(keyboard.state){if(!active())keyboard.cancel();else power=keyboard.power(now);}
    if(active()){
      const digital=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
      const steer=digital||stickValue||mouseSteer;
      acc=Math.min(acc+dt,.1);while(acc>=1/120){game.step(1/120,{steer,brake:braking||keys.has('ArrowDown')||keys.has('KeyS')});acc-=1/120;}
      if(game.stage==='finished')clear();
    }else acc=0;
    sync();view.render(game,dt,now/1000);
  }
  const fire=value=>{if(active())game.action(value);power=0;};
  const chargeOptions={enabled:()=>active()&&!game.air&&!game.recovery,context:()=>game.context,fire,progress:value=>{if(value!==null)power=value;},cancelled:()=>power=0,cancelKey:e=>!['ArrowLeft','ArrowRight','ArrowDown','KeyA','KeyD','KeyS'].includes(e.code)};
  mouse=installCharge({canvas:$('court'),...chargeOptions});
  button=installCharge({canvas:$('action'),...chargeOptions,allowTouch:true});
  $('action').onclick=event=>{if(event.detail===0)fire(.65);};
  $('court').addEventListener('pointermove',event=>{if(event.pointerType==='touch'||!active())return;const r=$('court').getBoundingClientRect();mouseSteer=Math.max(-1,Math.min(1,(event.clientX-r.left-r.width/2)/(r.width*.35)));});
  $('court').addEventListener('pointerleave',()=>mouseSteer=0);
  $('brake').addEventListener('pointerdown',event=>{if(!active()||brakePointer!==null)return;event.preventDefault();brakePointer=event.pointerId;braking=true;$('brake').setPointerCapture(brakePointer);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])$('brake').addEventListener(type,event=>{if(event.pointerId===brakePointer){braking=false;brakePointer=null;}});
  window.addEventListener('keydown',event=>{
    if(isEditing(event.target))return;
    if(event.code==='Escape'||event.code==='KeyP'){if(active())$('pause').click();return;}
    if(event.key==='?'){$('help').click();return;}if(!active())return;
    if(['ArrowLeft','ArrowRight','ArrowDown','Space'].includes(event.code))event.preventDefault();
    keys.add(event.code);if(event.code==='Space'&&!event.repeat)keyboard.begin(performance.now(),game.context);
  });
  window.addEventListener('keyup',event=>{keys.delete(event.code);if(event.code==='Space'){const value=keyboard.release(performance.now(),active()?game.context:Symbol());if(value!==null)fire(value);}});
  $('start').onclick=start;$('again').onclick=start;$('restart').onclick=start;
  $('help').onclick=()=>{clear();$('help-dialog').showModal();};$('pause').onclick=()=>{if(active()){clear();$('pause-dialog').showModal();}};
  $('resume').onclick=()=>$('pause-dialog').close();
  $('quit').onclick=()=>{clear();$('pause-dialog').close();game=new Game();sync();$('start').focus();};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  $('reload').onclick=()=>location.reload();
  installLifecycle({canvas:$('court'),dialogs,clear,active,pause:()=>$('pause-dialog').showModal(),fatal});
  observeSurface($('court'),()=>view?.resize());
  try{await document.fonts.ready;view=new View($('court'));$('start').disabled=false;sync();frame=requestAnimationFrame(loop);}catch(error){fatal(error);}
}
