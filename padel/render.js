import * as THREE from '../vendor/three.module.min.js';
import { COURT, clamp } from './rules.js';

const BLUE=0x2a42ad, RED=0xc94b59, PAPER=0xf7f4e9, GRAPHITE=0x64708c;
const V=(x,y,z)=>new THREE.Vector3(x,y,z);

// Original world-space pen shader. It shades geometry with crosshatching,
// keeping the strokes attached to the court as the camera moves.
function penMaterial(color=BLUE,fill=0.07) {
  return new THREE.ShaderMaterial({
    uniforms:{ink:{value:new THREE.Color(color)},paper:{value:new THREE.Color(PAPER)},fill:{value:fill}},
    vertexShader:`varying vec3 wp; varying vec3 wn;
      void main(){vec4 w=modelMatrix*vec4(position,1.0);wp=w.xyz;wn=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform vec3 ink;uniform vec3 paper;uniform float fill;varying vec3 wp;varying vec3 wn;
      void main(){vec3 n=normalize(wn);float light=dot(n,normalize(vec3(-.4,.9,.6)))*.5+.5;
      vec2 p=abs(n.y)>.55?wp.xz:(abs(n.x)>.55?wp.zy:wp.xy);
      float h1=1.-smoothstep(.035,.12,abs(fract((p.x+p.y)*11.)-.5));
      float h2=1.-smoothstep(.035,.11,abs(fract((p.x-p.y)*13.)-.5));
      float hatch=h1*(1.-smoothstep(.4,.77,light))+h2*(1.-smoothstep(.14,.36,light))*.5;
      float amount=clamp(fill+(1.-light)*.06+hatch*.3,0.,.86);
      gl_FragColor=vec4(mix(paper,ink,amount),1.);
      #include <colorspace_fragment>
      }`
  });
}

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
    this.raycaster=new THREE.Raycaster();this.ground=new THREE.Plane(V(0,1,0),0);
    this.point=V(0,0,0);this.projectPoint=V(0,0,0);
    this.buildCourt();this.buildDistrict();
    for(let i=0;i<4;i++)this.players.push(this.makePlayer(i<2?BLUE:RED,i));
    this.ball=this.mesh(new THREE.SphereGeometry(COURT.ballRadius*1.18,14,10),0xc4c725,.95,true);
    this.scene.add(this.ball);
    this.ballOutline=new THREE.Mesh(new THREE.SphereGeometry(COURT.ballRadius*1.28,14,10),new THREE.MeshBasicMaterial({color:BLUE,side:THREE.BackSide}));this.ball.add(this.ballOutline);
    this.shadow=this.disk(0.16,BLUE,.22);this.scene.add(this.shadow);
    this.target=this.ring(0.29,BLUE);this.scene.add(this.target);this.target.position.set(-2,0.035,-7.5);
    this.targetDot=this.disk(.035,BLUE,.8);this.target.add(this.targetDot);this.targetDot.rotation.x=0;
    this.activeRing=this.ring(0.54,BLUE);this.scene.add(this.activeRing);
    const trailGeometry=new THREE.BufferGeometry();trailGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(28*3),3));
    this.trailLine=new THREE.Line(trailGeometry,new THREE.LineBasicMaterial({color:0xbaa919,transparent:true,opacity:.6}));this.trailLine.frustumCulled=false;this.scene.add(this.trailLine);
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
  bar(a,b,r=.025,color=BLUE,parent=this.scene) {const start=V(...a),end=V(...b);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,start.distanceTo(end),6),new THREE.MeshBasicMaterial({color}));mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(V(0,1,0),end.sub(start).normalize());parent.add(mesh);return mesh;}
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
  makePlayer(color,id) {
    const root=new THREE.Group();root.rotation.y=id<2?Math.PI:0;this.scene.add(root);
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
    const racket=new THREE.Group();racket.position.set(.06,-.51,.14);arms[1].add(racket);racket.rotation.x=-.18;racket.rotation.z=-.22;
    const handle=this.box(.065,.24,.065,color,.8);racket.add(handle);
    const face=this.mesh(new THREE.CylinderGeometry(.225,.215,.055,16),color,.43,true);face.rotation.x=Math.PI/2;face.scale.y=1;face.scale.z=1.25;face.position.y=-.33;racket.add(face);
    for(let x=-.12;x<=.12;x+=.08)for(let y=-.47;y<=-.2;y+=.075) {
      if((x/.18)**2+((y+.33)/.22)**2>1)continue;
      const hole=new THREE.Mesh(new THREE.CircleGeometry(.018,6),new THREE.MeshBasicMaterial({color:PAPER,side:THREE.DoubleSide}));hole.position.set(x,y,.038);racket.add(hole);
    }
    const shadow=this.disk(.33,color,.12);shadow.position.y=.025;root.add(shadow);
    return {root,body,legs,arms,id};
  }
  resize() {
    this.width=innerWidth;this.height=innerHeight;
    this.renderer.setSize(this.width,this.height,false);this.camera.aspect=this.width/this.height;
    this.camera.updateProjectionMatrix();
  }
  setLobby(value){this.lobby=value;this.target.visible=!value;this.activeRing.visible=!value;this.trail=[];}
  aimAt(clientX,clientY) {
    this.raycaster.setFromCamera(new THREE.Vector2(clientX/this.width*2-1,-clientY/this.height*2+1),this.camera);
    const point=this.raycaster.ray.intersectPlane(this.ground,this.point);
    if(!point)return null;
    return {x:clamp(point.x,-4.4,4.4),z:-clamp(Math.abs(Math.min(point.z,-2.2)),2.2,9)};
  }
  effect(event) {
    if(event.type!=='wall')return;
    const circle=new THREE.Mesh(new THREE.RingGeometry(.12,.15,24),new THREE.MeshBasicMaterial({color:RED,transparent:true,opacity:1,side:THREE.DoubleSide,depthWrite:false}));
    circle.position.set(event.x,event.y,event.z);if(event.axis==='x')circle.rotation.y=Math.PI/2;
    this.scene.add(circle);this.effects.push({mesh:circle,life:.5});
  }
  render(game,dt,time) {
    const mobile=this.width<650;
    let cx=this.mode==='end'?0:13.5,cy=this.mode==='end'?14:21,cz=this.mode==='end'?30:27;
    if(mobile){cx=3;cy=29;cz=31;}
    if(this.lobby){cx=16+Math.sin(time*.1)*.7;cy=22;cz=28;}
    const factor=1-Math.exp(-dt*4);
    this.camera.position.lerp(V(cx,cy,cz),factor);
    this.camera.lookAt(0,0,this.lobby&&mobile?3.5:0);
    if(this.lobby&&!mobile)this.camera.setViewOffset(this.width,this.height,-this.width*.14,0,this.width,this.height);
    else if(this.lobby&&mobile)this.camera.setViewOffset(this.width,this.height,0,this.height*.25,this.width,this.height);
    else this.camera.clearViewOffset();
    // Keep court margins safe on narrow portrait screens.
    this.camera.fov=mobile?46:39;this.camera.updateProjectionMatrix();
    this.players.forEach((model,i)=>{
      const p=game.players[i];model.root.position.set(p.x,0,p.z);
      const running=Math.min(1,Math.hypot(p.vx,p.vz)/4);
      model.legs[0].rotation.x=Math.sin(time*15+i)*.58*running;
      model.legs[1].rotation.x=-model.legs[0].rotation.x;
      model.body.position.y=Math.abs(Math.sin(time*15+i))*.045*running;
      const swing=p.swing>0?Math.sin((1-p.swing/.4)*Math.PI):0;
      model.arms[1].rotation.x=-.2-swing*1.65;model.arms[1].rotation.z=-.1-swing*.5;
      model.arms[0].rotation.x=-.25+model.legs[0].rotation.x*.6;
      const angle=Math.atan2(game.ball.x-p.x,game.ball.z-p.z);
      let diff=angle-model.root.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));
      model.root.rotation.y+=diff*(1-Math.exp(-dt*7));
    });
    const b=game.ball;this.ball.position.set(b.x,b.y,b.z);this.ball.rotation.x+=dt*5;
    this.shadow.position.set(b.x,.035,b.z);this.shadow.scale.setScalar(1+Math.max(0,b.y)*.13);this.shadow.material.opacity=.3/(1+b.y*.3);
    const p=game.players[game.controlled];this.activeRing.position.set(p.x,.036,p.z);
    this.target.position.set(game.aim.x,.038,game.aim.z);this.target.rotation.z=time*.6;
    if(game.stage==='rally')this.trail.unshift(V(b.x,b.y,b.z));else this.trail=[];
    this.trail.length=Math.min(this.trail.length,28);
    const attr=this.trailLine.geometry.attributes.position;
    for(let i=0;i<this.trail.length;i++)attr.setXYZ(i,this.trail[i].x,this.trail[i].y,this.trail[i].z);
    attr.needsUpdate=true;this.trailLine.geometry.setDrawRange(0,this.trail.length);
    for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.life-=dt;e.mesh.scale.setScalar(1+(0.5-e.life)*6);e.mesh.material.opacity=e.life*2;if(e.life<=0){this.scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();this.effects.splice(i,1);}}
    this.renderer.render(this.scene,this.camera);
    this.projectPoint.set(p.x,2.1,p.z).project(this.camera);
    return {x:(this.projectPoint.x*.5+.5)*this.width,y:(-.5*this.projectPoint.y+.5)*this.height};
  }
}
