import { makeRacketPlayer, animateRacketPlayers } from '../shared/racket-player.js';
import * as THREE from '../vendor/three.module.min.js';
import { COURT, clamp } from './rules.js';
import { strokePose } from './feel.js';
import { courtCameraPose, PlayerEye } from './camera.js';
import { batchStaticInk } from './static-ink.js';

const BLUE=0x2a42ad, RED=0xc94b59, PAPER=0xf7f4e9, GRAPHITE=0x64708c;
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

import { penMaterial } from '../shared/ink.js';

export class CourtView {
  constructor(canvas) {
    this.canvas=canvas;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
    this.renderer.setClearColor(PAPER,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(39,1,0.1,180);
    this.camera.position.set(15,22,28);this.camera.lookAt(0,0,0);
    this.materials=new Map();this.lineMaterials=new Map();
    this.mode='raised';this.lobby=true;this.players=[];this.effects=[];this.trail=[];
    this.eye = new PlayerEye(); this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.trailClock = 0; this.trailSample = 0;
    this.raycaster=new THREE.Raycaster();this.ground=new THREE.Plane(V(0,1,0),0);
    this.point=V(0,0,0);this.projectPoint=V(0,0,0);
    this.buildCourt();this.buildDistrict();
    this.staticBatch=batchStaticInk(this.scene);
    for(let i=0;i<4;i++)this.players.push(this.makePlayer(i<2?BLUE:RED,i));
    this.ball=this.mesh(new THREE.SphereGeometry(COURT.ballRadius*1.18,14,10),0xc4c725,.95,true);
    this.scene.add(this.ball);
    this.ballOutline=new THREE.Mesh(new THREE.SphereGeometry(COURT.ballRadius*1.28,14,10),new THREE.MeshBasicMaterial({color:BLUE,side:THREE.BackSide}));this.ball.add(this.ballOutline);
    this.shadow=this.disk(0.16,BLUE,.22);this.scene.add(this.shadow);
    this.target=this.ring(0.29,BLUE);this.scene.add(this.target);this.target.position.set(-2,0.035,-7.5);
    this.targetDot=this.disk(.035,BLUE,.8);this.target.add(this.targetDot);this.targetDot.rotation.x=0;
    this.activeRing=this.ring(0.54,BLUE);this.scene.add(this.activeRing);
    this.practiceRing=this.ring(1.4,RED);this.scene.add(this.practiceRing);this.practiceRing.visible=false;
    const guideGeometry = new THREE.BufferGeometry();
    guideGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
    this.heightGuide = new THREE.Line(guideGeometry, this.lineMat(BLUE, .22));this.heightGuide.frustumCulled=false;this.scene.add(this.heightGuide);
    const trailGeometry=new THREE.BufferGeometry();trailGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(28*3),3));
    this.trailLine=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({color:0xbaa919,transparent:true,opacity:.6}));this.trailLine.frustumCulled=false;this.scene.add(this.trailLine);
    // A bounded pool: contacts never allocate or dispose geometry during play.
    for (let i=0;i<12;i++) {
      const mesh=this.ring(.15,BLUE);mesh.visible=false;mesh.material.depthWrite=false;this.scene.add(mesh);
      this.effects.push({mesh,life:0,duration:.3,billboard:false});
    }
    this.resize();
  }
  mat(color,fill=.07) {const key=`${color}:${fill}`;if(!this.materials.has(key))this.materials.set(key,penMaterial(color,fill));return this.materials.get(key);}
  lineMat(color,opacity=1) {const key=`${color}:${opacity}`;if(!this.lineMaterials.has(key))this.lineMaterials.set(key,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));return this.lineMaterials.get(key);}
  mesh(geometry,color=BLUE,fill=.07,round=false) {
    const mesh=new THREE.Mesh(geometry,this.mat(color,fill));
    if(round){const shell=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,side:THREE.BackSide}));shell.scale.setScalar(1.045);mesh.add(shell);}
    else{mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry,24),this.lineMat(color,.8)));}
    return mesh;
  }
  box(w,h,d,color=BLUE,fill=.05){return this.mesh(new THREE.BoxGeometry(w,h,d),color,fill);}
  line(points,color=BLUE,opacity=.8,parent=this.scene) {const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>V(...p))),this.lineMat(color,opacity));parent.add(l);return l;}
  bar(a,b,r=.025,color=BLUE,parent=this.scene) {
    this.barGeometry??=new THREE.CylinderGeometry(1,1,1,6);this.barMaterials??=new Map();
    if(!this.barMaterials.has(color))this.barMaterials.set(color,new THREE.MeshBasicMaterial({color}));
    const start=V(...a),end=V(...b),length=start.distanceTo(end);
    const mesh=new THREE.Mesh(this.barGeometry,this.barMaterials.get(color));
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(V(0,1,0),end.sub(start).normalize());
    mesh.scale.set(r,length,r);mesh.userData.staticBar=true;parent.add(mesh);return mesh;
  }
  disk(r,color,opacity) {const m=new THREE.Mesh(new THREE.CircleGeometry(r,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false}));m.rotation.x=-Math.PI/2;return m;}
  ring(r,color) {const m=new THREE.Mesh(new THREE.RingGeometry(r-.023,r+.023,48),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.8}));m.rotation.x=-Math.PI/2;return m;}
  textSprite(text,color=BLUE,size=1.2) {
    const c=document.createElement('canvas');c.width=512;c.height=96;
    const ctx=c.getContext('2d');ctx.font='50px Patrick, Comic Sans MS, cursive';ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,48);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));sprite.scale.set(size*5.33,size,1);return sprite;
  }
  buildCourt() {
    const slab=this.box(10.5,.12,20.5,BLUE,.015);slab.position.y=-.09;this.scene.add(slab);
    const turf=new THREE.Mesh(new THREE.PlaneGeometry(10,20),this.mat(BLUE,.075));turf.rotation.x=-Math.PI/2;turf.position.y=-.019;this.scene.add(turf);
    // Sparse hand-laid court hatching, with exact service-line dimensions.
    for(let z=-9.8;z<10;z+=.26)this.line([[-4.92,.004,z],[-4.68,.004,z+.11]],BLUE,.21);
    const lineY=.018;
    this.line([[-5,lineY,-10],[5,lineY,-10],[5,lineY,10],[-5,lineY,10],[-5,lineY,-10]],BLUE,1);
    for(const s of [-1,1]) {
      this.bar([-5,lineY,s*6.95],[5,lineY,s*6.95],.024,BLUE);
      this.bar([0,lineY,0],[0,lineY,s*7.15],.024,BLUE);
      // Back wall: three metres of glass with one metre of mesh above it.
      const glass=new THREE.Mesh(new THREE.PlaneGeometry(10,3),new THREE.MeshBasicMaterial({color:0x749bcd,transparent:true,opacity:s===1?.025:.075,side:THREE.DoubleSide,depthWrite:false}));glass.position.set(0,1.5,s*10);this.scene.add(glass);
      for(let x=-5;x<=5;x+=2.5)this.bar([x,0,s*10],[x,4,s*10],.023,BLUE);
      for(const y of [0,3,4])this.bar([-5,y,s*10],[5,y,s*10],.023,BLUE);
      for(let x=-4.8;x<5;x+=.32)this.line([[x,3,s*10],[x,4,s*10]],BLUE,.22);
      for(let y=3.2;y<4;y+=.2)this.line([[-5,y,s*10],[5,y,s*10]],BLUE,.22);
      for(const x of [-3.7,-1.2,1.3,3.8]) {
        this.line([[x,1,s*10],[x+.38,1.7,s*10]],BLUE,.19);
        this.line([[x+.18,1,s*10],[x+.44,1.48,s*10]],BLUE,.15);
      }
    }
    for(const x of [-5,5]) {
      for(let z=-10;z<=10;z+=2)this.bar([x,0,z],[x,3,z],.021,BLUE);
      this.bar([x,3,-10],[x,3,10],.023,BLUE);
      this.bar([x,0,-10],[x,0,10],.024,BLUE);
      for(const s of [-1,1]) {
        const glass=new THREE.Mesh(new THREE.PlaneGeometry(4,3),new THREE.MeshBasicMaterial({color:0x749bcd,transparent:true,opacity:x===5?.025:.065,side:THREE.DoubleSide,depthWrite:false}));glass.rotation.y=Math.PI/2;glass.position.set(x,1.5,s*8);this.scene.add(glass);
        this.bar([x,4,s*8],[x,4,s*10],.023,BLUE);this.bar([x,3,s*8],[x,4,s*8],.023,BLUE);
        for(let z=8;z<10;z+=.35)this.line([[x,3,s*z],[x,4,s*z]],BLUE,.2);
      }
      for(let z=-5.8;z<6;z+=.34)this.line([[x,.05,z],[x,3,z]],BLUE,.16);
      for(let y=.3;y<3;y+=.3)this.line([[x,y,-6],[x,y,6]],BLUE,.16);
    }
    // Net follows the regulation sag: .88 m at centre, .92 m at ends.
    this.bar([-5,0,0],[-5,1.03,0],.06,BLUE);this.bar([5,0,0],[5,1.03,0],.06,BLUE);
    const top=[];for(let x=-5;x<=5;x+=.25)top.push([x,.88+Math.abs(x)/5*.04,0]);this.line(top,BLUE,1);
    for(let x=-5;x<=5;x+=.23)this.line([[x,.05,0],[x,.88+Math.abs(x)*.008,0]],BLUE,.65);
    for(let y=.16;y<.87;y+=.15)this.line([[-5,y,0],[0,y-.03,0],[5,y,0]],BLUE,.6);
    for(let y=0;y<.055;y+=.014)this.line(top.map(([x,h,z])=>[x,h-y,z]),BLUE,.95);
    const badge=this.textSprite('PADEL DISTRICT',BLUE,.56);badge.position.set(0,1.85,-10.03);this.scene.add(badge);
    const courtNumber=this.textSprite('COURT 01',BLUE,.42);courtNumber.position.set(-7,.05,10.7);this.scene.add(courtNumber);
  }
  buildDistrict() {
    // Quiet architectural context, using the same ink geometry as the court.
    const pavement=this.box(22,.08,30,GRAPHITE,0);pavement.position.y=-.21;this.scene.add(pavement);
    for(const x of [-6.2,6.2])for(const z of [-8,8]) {
      this.bar([x,0,z],[x,6.5,z],.047,BLUE);
      this.bar([x,6.5,z],[x-Math.sign(x)*.7,6.5,z],.037,BLUE);
      const light=this.box(.75,.2,.46,BLUE,.02);light.position.set(x-Math.sign(x)*.7,6.45,z);light.rotation.z=-Math.sign(x)*.2;this.scene.add(light);
    }
    for(const x of [-7.6,7.6]) {
      const bench=this.box(.65,.12,3.1,BLUE,.06);bench.position.set(x,.62,1.8);this.scene.add(bench);
      const back=this.box(.08,.5,3.1,BLUE,.035);back.position.set(x+Math.sign(x)*.3,.93,1.8);this.scene.add(back);
      for(const z of [.65,2.95])this.bar([x,.03,z],[x,.58,z],.04,BLUE);
      const bag=this.box(.42,.48,.85,RED,.08);bag.position.set(x,.93,2.5);bag.rotation.y=.12;this.scene.add(bag);
    }
    for(let i=0;i<5;i++) {
      const width=3.2+(i%2)*1.6,height=3.5+(i%3)*1.5;
      const building=this.box(width,height,2.4,GRAPHITE,.008);building.position.set((i-2)*5.1,height/2,-17-(i%2)*1.1);this.scene.add(building);
      for(let y=1.1;y<height-.3;y+=1.2)for(let x=-width/2+.7;x<width/2-.3;x+=1.05) {
        const window=this.box(.5,.68,.035,GRAPHITE,.08);window.position.set(x,y-height/2,1.22);building.add(window);
      }
    }
    const sign=this.textSprite('the district',GRAPHITE,.7);sign.position.set(9,2,-13);this.scene.add(sign);
    for(let i=0;i<4;i++) {
      const x=i<2?-9:9,z=-9+(i%2)*15;
      const pot=this.mesh(new THREE.CylinderGeometry(.54,.39,.55,9),GRAPHITE,.04);pot.position.set(x,.2,z);this.scene.add(pot);
      this.bar([x,.4,z],[x,2.1,z],.065,GRAPHITE);
      const canopy=this.mesh(new THREE.IcosahedronGeometry(1.12,1),GRAPHITE,.03);canopy.position.set(x,2.7,z);canopy.scale.set(.9,1.3,.9);this.scene.add(canopy);
    }
  }
  makePlayer(color,id) { return makeRacketPlayer(this, color, id); }
  resize() {
    const rect=this.canvas.getBoundingClientRect();
    this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);
    this.left=rect.left;this.top=rect.top;
    this.renderer.setSize(this.width,this.height,false);this.camera.aspect=this.width/this.height;
    this.camera.updateProjectionMatrix();
  }
  setLobby(value){this.lobby=value;this.target.visible=!value;this.activeRing.visible=!value;this.trail=[];}
  aimAt(clientX,clientY) {
    const rect=this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1),this.camera);
    const point=this.raycaster.ray.intersectPlane(this.ground,this.point);
    if(!point)return null;
    return {x:clamp(point.x,-4.4,4.4),z:-clamp(Math.abs(Math.min(point.z,-2.2)),2.2,9)};
  }
  effect(event) {
    if (event.type==='ready') {
      this.trail=[];
      for(const effect of this.effects){effect.life=0;effect.mesh.visible=false;}
      return;
    }
    if(!['hit','bounce','wall','net'].includes(event.type))return;
    const effect=this.effects.find(item=>item.life<=0)??this.effects[0];
    effect.duration=event.type==='wall'?.4:.24;effect.life=effect.duration;
    effect.billboard=event.type==='hit'||event.type==='net';
    const circle=effect.mesh;circle.visible=true;circle.scale.setScalar(1);
    circle.material.color.setHex(event.type==='wall'||event.type==='net'?RED:BLUE);
    circle.material.opacity=.8;circle.rotation.set(0,0,0);
    circle.position.set(event.x,event.type==='bounce'?.04:event.y,event.z);
    if(event.type==='bounce')circle.rotation.x=-Math.PI/2;
    else if(event.axis==='x')circle.rotation.y=Math.PI/2;
  }
  render(game,dt,time,state=game) {
    this.cameraState=state;this.playerEye=this.eye.update(state,dt,this.reducedMotion);
    const mobile=innerWidth<650;
    let cx=this.mode==='end'?0:13.5,cy=this.mode==='end'?14:21,cz=this.mode==='end'?30:27;
    if(mobile){cx=3;cy=29;cz=31;}
    if(this.lobby){cx=16+Math.sin(time*.1)*.7;cy=22;cz=28;}
    const fitted=courtCameraPose(this.width/this.height,39,!mobile&&this.mode!=='end');
    const factor=this.reducedMotion?1:1-Math.exp(-dt*10);
    this.camera.position.lerp(this.lobby?V(cx,cy,cz):fitted.eye,factor);
    this.camera.lookAt(this.lobby?V(0,0,mobile?3.5:0):fitted.center);
    if(this.lobby&&!mobile)this.camera.setViewOffset(this.width,this.height,-this.width*.14,0,this.width,this.height);
    else if(this.lobby&&mobile)this.camera.setViewOffset(this.width,this.height,0,this.height*.25,this.width,this.height);
    else this.camera.clearViewOffset();
    // Keep court margins safe on narrow portrait screens.
    this.camera.fov=this.lobby&&mobile?46:39;this.camera.updateProjectionMatrix();
    this.views?.prepare();this.camera.updateMatrixWorld();
    animateRacketPlayers(this.players, state, dt, time, {pose:strokePose,footwork:true});
    const b=state.ball;this.ball.position.set(b.x,b.y,b.z);this.ball.rotation.x+=dt*5;
    const worldPerPixel=this.camera.isOrthographicCamera?(this.camera.top-this.camera.bottom)/this.height:2*Math.tan(this.camera.fov*Math.PI/360)*this.camera.position.distanceTo(this.ball.position)/this.height;
    this.ball.scale.setScalar(clamp(worldPerPixel*3.2/(COURT.ballRadius*1.18),1,2.4));
    this.shadow.position.set(b.x,.035,b.z);this.shadow.scale.setScalar(1+Math.max(0,b.y)*.13);this.shadow.material.opacity=.3/(1+b.y*.3);
    const p=state.players[game.controlled];this.activeRing.position.set(p.x,.036,p.z);
    this.activeRing.material.opacity=game.contactState?.(game.players[game.controlled]).ready?1:.5;
    this.target.position.set(game.aim.x,.038,game.aim.z);this.target.rotation.z=time*.6;
    this.practiceRing.visible=!this.lobby&&game.mode==='practice';
    if(this.practiceRing.visible)this.practiceRing.position.set(game.practiceTarget.x,.042,game.practiceTarget.z);
    const guide=this.heightGuide.geometry.attributes.position;
    guide.setXYZ(0,b.x,.04,b.z);guide.setXYZ(1,b.x,b.y,b.z);guide.needsUpdate=true;
    this.heightGuide.visible=!this.lobby&&b.y>.8;
    this.trailClock+=dt;
    if(game.stage==='rally'&&dt>0&&this.trailClock-this.trailSample>=1/120){
      this.trail.unshift({x:b.x,y:b.y,z:b.z,time:this.trailClock});this.trailSample=this.trailClock;
    }else if(game.stage!=='rally')this.trail=[];
    while(this.trail.length&&this.trailClock-this.trail.at(-1).time>.18)this.trail.pop();
    this.trail.length=Math.min(this.trail.length,28);
    const attr=this.trailLine.geometry.attributes.position;
    for(let i=0;i<this.trail.length;i++)attr.setXYZ(i,this.trail[i].x,this.trail[i].y,this.trail[i].z);
    attr.needsUpdate=true;this.trailLine.geometry.setDrawRange(0,this.trail.length);
    for(const effect of this.effects){
      if(effect.life<=0)continue;
      effect.life=Math.max(0,effect.life-dt);effect.mesh.visible=effect.life>0;
      effect.mesh.scale.setScalar(this.reducedMotion?1.5:1+(effect.duration-effect.life)*7);
      effect.mesh.material.opacity=effect.life/effect.duration*.8;
      if(effect.billboard)effect.mesh.quaternion.copy(this.camera.quaternion);
    }
    this.renderer.render(this.scene,this.camera);
    this.projectPoint.set(p.x,2.1,p.z).project(this.camera);
    return {x:this.left+(this.projectPoint.x*.5+.5)*this.width,y:this.top+(-.5*this.projectPoint.y+.5)*this.height};
  }
}
