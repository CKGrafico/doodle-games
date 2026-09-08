import * as THREE from '../vendor/three.module.min.js';
import { FIELD, clamp } from './rules.js';

const BLUE=0x2a42ad, RED=0xc94b59, PAPER=0xf7f4e9, GRAPHITE=0x64708c;
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

import { penMaterial } from '../shared/ink.js';

export class FootballView {
  constructor(canvas){
    this.canvas=canvas;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.setClearColor(PAPER,0);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-70,70,40,-40,.1,500);
    this.materials=new Map();this.lineMaterials=new Map();this.mode='broadcast';this.lobby=true;this.focus=V(0,0,0);this.yaw=Math.atan2(75,16);
    this.raycaster=new THREE.Raycaster();this.ground=new THREE.Plane(V(0,1,0),0);this.point=V(0,0,0);
    this.buildPitch();this.buildDistrict();this.players=Array.from({length:22},(_,i)=>this.makePlayer(i%11===0?GRAPHITE:i<11?BLUE:RED,i));
    this.ball=this.mesh(new THREE.IcosahedronGeometry(.43,1),BLUE,.07);this.scene.add(this.ball);
    const seams=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(.438,1)),this.lineMat(BLUE,.7));this.ball.add(seams);
    this.shadow=this.disk(.6,BLUE,.2);this.scene.add(this.shadow);this.activeRing=this.ring(1.15,BLUE);this.scene.add(this.activeRing);
    this.target=this.ring(1,RED);this.scene.add(this.target);this.resize();
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
  bar(a,b,r=.025,color=BLUE,parent=this.scene) {const start=V(...a),end=V(...b);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,start.distanceTo(end),6),new THREE.MeshBasicMaterial({color}));mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(V(0,1,0),end.sub(start).normalize());parent.add(mesh);return mesh;}
  disk(r,color,opacity) {const m=new THREE.Mesh(new THREE.CircleGeometry(r,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false}));m.rotation.x=-Math.PI/2;return m;}
  ring(r,color) {const m=new THREE.Mesh(new THREE.RingGeometry(r-.023,r+.023,48),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.8}));m.rotation.x=-Math.PI/2;return m;}
  textSprite(text,color=BLUE,size=1.2) {
    const c=document.createElement('canvas');c.width=512;c.height=96;
    const ctx=c.getContext('2d');ctx.font='50px Patrick, Comic Sans MS, cursive';ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,48);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));sprite.scale.set(size*5.33,size,1);return sprite;
  }
  makePlayer(color,id) {
    const root=new THREE.Group();root.rotation.y=id<11?Math.PI:0;this.scene.add(root);root.scale.setScalar(1.55);
    const body=new THREE.Group();root.add(body);
    const torso=this.mesh(new THREE.CapsuleGeometry(.245,.35,4,9),color,.36,true);torso.position.y=1.03;body.add(torso);
    const shorts=this.box(.45,.24,.32,color,.75);shorts.position.y=.73;body.add(shorts);
    const head=this.mesh(new THREE.SphereGeometry(.24,12,9),color,.015,true);head.scale.set(.93,1.1,.96);head.position.y=1.59;body.add(head);
    const hair=this.mesh(new THREE.SphereGeometry(.247,12,8,0,Math.PI*2,0,1.28),color,.7,true);hair.position.copy(head.position);body.add(hair);
    const band=this.mesh(new THREE.CylinderGeometry(.248,.248,.062,16),color,.07);band.position.y=1.69;body.add(band);
    for(const x of [-.074,.074]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.019,6,5),new THREE.MeshBasicMaterial({color}));eye.position.set(x,1.6,.218);body.add(eye);}
    const legs=[];
    for(const x of [-.14,.14]) {
      const leg=new THREE.Group();leg.position.set(x,.65,0);body.add(leg);
      const shin=this.mesh(new THREE.CapsuleGeometry(.075,.33,3,7),color,.015,true);shin.position.y=-.25;leg.add(shin);
      const shoe=this.mesh(new THREE.BoxGeometry(.18,.12,.31),color,.45);shoe.position.set(0,-.57,.05);leg.add(shoe);legs.push(leg);
    }
    const arms=[];
    for(const x of [-.31,.31]) {
      const arm=new THREE.Group();arm.position.set(x,1.2,0);body.add(arm);
      const limb=this.mesh(new THREE.CapsuleGeometry(.066,.35,3,7),color,.02,true);limb.position.set(Math.sign(x)*.025,-.24,.045);limb.rotation.x=-.18;arm.add(limb);arms.push(arm);
    }
    const shadow=this.disk(.33,color,.12);shadow.position.y=.025;root.add(shadow);
    return {root,body,legs,arms,id};
  }


  buildPitch(){
    const pitch=this.box(68,.2,105,BLUE,.035);pitch.position.y=-.14;this.scene.add(pitch);
    const apron=this.box(80,.18,118,GRAPHITE,0);apron.position.y=-.34;this.scene.add(apron);
    for(let z=-52.5;z<52.5;z+=10.5){const stripe=new THREE.Mesh(new THREE.PlaneGeometry(68,5.25),new THREE.MeshBasicMaterial({color:BLUE,transparent:true,opacity:.035}));stripe.rotation.x=-Math.PI/2;stripe.position.set(0,-.025,z+2.625);this.scene.add(stripe);}
    this.line([[-34,.02,-52.5],[34,.02,-52.5],[34,.02,52.5],[-34,.02,52.5],[-34,.02,-52.5]],BLUE,1);
    this.line([[-34,.02,0],[34,.02,0]],BLUE,1);this.scene.add(this.ring(9.15,BLUE));
    const centre=this.disk(.25,BLUE,1);centre.position.y=.02;this.scene.add(centre);
    for(const d of [-1,1]){
      for(const [w,depth] of [[20.16,16.5],[9.16,5.5]])this.line([[-w,.025,d*52.5],[-w,.025,d*(52.5-depth)],[w,.025,d*(52.5-depth)],[w,.025,d*52.5]],BLUE,1);
      const spot=this.disk(.22,BLUE,1);spot.position.set(0,.025,d*41.5);this.scene.add(spot);
      const arc=[];for(let i=0;i<=40;i++){const a=Math.PI*.205+i/40*Math.PI*.59;arc.push([Math.cos(a)*9.15,.025,d*(41.5-Math.sin(a)*9.15)]);}this.line(arc,BLUE,.9);
      this.bar([-3.66,0,d*52.5],[-3.66,2.44,d*52.5],.08,BLUE);this.bar([3.66,0,d*52.5],[3.66,2.44,d*52.5],.08,BLUE);this.bar([-3.66,2.44,d*52.5],[3.66,2.44,d*52.5],.08,BLUE);
      for(const x of [-3.66,3.66])this.line([[x,2.44,d*52.5],[x,2.44,d*55],[x,0,d*55],[x,0,d*52.5]],BLUE,.55);
      for(let x=-3.66;x<=3.66;x+=.4)this.line([[x,0,d*55],[x,2.44,d*55],[x,2.44,d*52.5]],BLUE,.25);
      for(let y=0;y<=2.44;y+=.35)this.line([[-3.66,y,d*52.5],[-3.66,y,d*55],[3.66,y,d*55],[3.66,y,d*52.5]],BLUE,.25);
      for(const x of [-34,34]){this.bar([x,0,d*52.5],[x,1.7,d*52.5],.06,RED);const flag=this.box(.8,.5,.025,RED,.5);flag.position.set(x+.4,1.45,d*52.5);this.scene.add(flag);}
    }
  }
  buildDistrict(){
    for(const x of [-42,42]){
      for(let row=0;row<3;row++){const bleacher=this.box(2,1.1,92,GRAPHITE,.015);bleacher.position.set(x+Math.sign(x)*row*2,row*.9+.55,0);this.scene.add(bleacher);}
      for(let j=0;j<27;j++)for(let row=0;row<3;row++){
        const fan=this.mesh(new THREE.SphereGeometry(.35,6,5),j%4===0?RED:BLUE,.1,true);fan.position.set(x+Math.sign(x)*row*2,1.7+row*.9,(j-13)*3.2);this.scene.add(fan);
        this.line([[fan.position.x,fan.position.y-.4,fan.position.z],[fan.position.x,fan.position.y-1,fan.position.z]],GRAPHITE,.6);
      }
      for(const z of [-44,44]){this.bar([x,0,z],[x,15,z],.13,BLUE);const light=this.box(4,1.5,.8,BLUE,.04);light.position.set(x,15,z);this.scene.add(light);}
      const board=this.box(.25,1.3,70,BLUE,.005);board.position.set(Math.sign(x)*37,1,0);this.scene.add(board);
    }
    const banner=this.textSprite('FOOTBALL DISTRICT',BLUE,3);banner.position.set(-4,5,-65);this.scene.add(banner);
    for(let i=0;i<6;i++){const h=7+i%3*3,b=this.box(9,h,6,GRAPHITE,.01);b.position.set((i-2.5)*13,h/2,-78);this.scene.add(b);for(let y=3;y<h;y+=3)for(let x=-3;x<=3;x+=3){const win=this.box(1.3,1.6,.02,GRAPHITE,.02);win.position.set(b.position.x+x,y,-74.98);this.scene.add(win);}}
  }
  setLobby(value){this.lobby=value;this.resize();}
  resize(){
    const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h,false);const aspect=w/h;
    let height=this.lobby?(w<650?125:112):this.mode==='tactical'?100:w<650?72:62;
    if(this.lobby&&aspect>1.3)height=100;
    this.camera.left=-height*aspect/2;this.camera.right=height*aspect/2;this.camera.top=height/2;this.camera.bottom=-height/2;
    this.camera.updateProjectionMatrix();
  }
  aimAt(x,y){this.raycaster.setFromCamera({x:x/innerWidth*2-1,y:1-y/innerHeight*2},this.camera);if(!this.raycaster.ray.intersectPlane(this.ground,this.point))return null;return{x:clamp(this.point.x,-34,34),z:clamp(this.point.z,-54,54)};}
  render(game,dt,time){
    let fx=this.lobby?0:this.mode==='tactical'?0:clamp(game.ball.x*.5,-12,12),fz=this.lobby?0:this.mode==='tactical'?0:clamp(game.ball.z*.65,-32,32);
    const desired=V(fx,0,fz);if(this.lobby){if(innerWidth>650){desired.x-=3;desired.z+=23;}else desired.x+=13;}
    this.focus.lerp(desired,1-Math.exp(-dt*3));this.camera.position.copy(this.focus).add(V(75,85,16));this.camera.lookAt(this.focus);
    for(const p of game.players){const v=this.players[p.id];v.root.position.set(p.x,0,p.z);v.root.rotation.y=p.facing;const speed=Math.hypot(p.vx,p.vz),stride=Math.sin(time*13+p.id)*Math.min(speed*.07,.55);
      v.legs[0].rotation.x=stride-p.kick*.8;v.legs[1].rotation.x=-stride;v.arms[0].rotation.x=-stride*.55;v.arms[1].rotation.x=stride*.55;
      v.body.position.y=Math.abs(stride)*.05;v.body.rotation.z=p.dive?Math.sin(time*11)*.4:0;
      if(game.stage==='goal'&&p.team===game.scoringTeam){v.body.position.y=Math.abs(Math.sin(time*5+p.id))*.5;v.arms[0].rotation.z=-2;v.arms[1].rotation.z=2;}else{v.arms[0].rotation.z=.1;v.arms[1].rotation.z=-.1;}
    }
    const b=game.ball;this.ball.position.set(b.x,b.y+.08,b.z);this.ball.rotation.x+=dt*b.vz;this.ball.rotation.z-=dt*b.vx;this.shadow.position.set(b.x,.035,b.z);this.shadow.scale.setScalar(1+b.y*.08);
    const p=game.players[game.controlled];this.activeRing.visible=!this.lobby;this.activeRing.position.set(p.x,.04,p.z);
    this.target.visible=!this.lobby&&!!game.aim&&game.ball.owner!==null&&game.players[game.ball.owner].team===0;if(game.aim)this.target.position.set(game.aim.x,.04,game.aim.z);
    this.renderer.render(this.scene,this.camera);const label=V(p.x,3.7,p.z).project(this.camera);return{x:(label.x+1)*innerWidth/2,y:(1-label.y)*innerHeight/2};
  }
}
