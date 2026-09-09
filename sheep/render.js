import * as THREE from '../vendor/three.module.min.js';
import { penMaterial, outlineMeshes } from '../shared/ink.js';
import { clamp } from './simulation.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export class SheepView {
  constructor(canvas){
    this.canvas=canvas;this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(48,1,.1,160);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor(0xf7f4e9,0);
    this.materials=[penMaterial(0x2941ad,.025),penMaterial(0x2941ad,.5),penMaterial(0xc94b59,.5),penMaterial(0x46495d,.72)];
    this.ground=this.mesh(new THREE.BoxGeometry(30,.2,40),0);this.ground.position.y=-.15;
    this.world=new THREE.Group();this.scene.add(this.world);this.flock=[];this.players=[this.dog()];this.level=-1;this.lobby=true;
    this.ray=new THREE.Raycaster();this.plane=new THREE.Plane(V(0,1,0),0);this.point=V();
    this.target=new THREE.Mesh(new THREE.RingGeometry(.45,.52,24),new THREE.MeshBasicMaterial({color:0xc94b59,side:THREE.DoubleSide}));this.target.rotation.x=-Math.PI/2;this.target.position.y=.025;this.scene.add(this.target);
    this.ring=new THREE.Mesh(new THREE.RingGeometry(.98,1,48),new THREE.MeshBasicMaterial({color:0x2941ad,side:THREE.DoubleSide,transparent:true,opacity:.5}));this.ring.rotation.x=-Math.PI/2;this.scene.add(this.ring);
    this.resize();
  }
  mesh(geometry,index,parent=this.scene){const m=new THREE.Mesh(geometry,this.materials[index]);parent.add(m);return m;}
  animal(sheep,index=0){
    const group=new THREE.Group();this.scene.add(group);group.userData.legs=[];
    const body=this.mesh(new THREE.SphereGeometry(1,12,9),sheep?(index%3===2?3:0):1,group);body.scale.set(sheep?.56:.32,sheep?.5:.35,sheep?.72:.65);body.position.y=sheep?.8:.58;
    if(sheep)for(let i=0;i<7;i++){const tuft=this.mesh(new THREE.SphereGeometry(.26,7,6),index%3===2?3:0,group);tuft.position.set(Math.sin(i*2.4)*.42,1+Math.cos(i*2.4)*.2,(i%3-1)*.37);}
    const head=this.mesh(new THREE.SphereGeometry(.26,10,7),sheep?3:0,group);head.scale.set(1,1,1.3);head.position.set(0,sheep?.86:.84,-.64);
    for(const side of [-1,1]){
      const ear=this.mesh(new THREE.SphereGeometry(.13,7,5),sheep?3:1,group);ear.scale.set(1,.45,1.5);ear.position.set(side*.3,sheep?.98:.94,-.58);
      const eye=this.mesh(new THREE.SphereGeometry(.055,6,5),0,group);eye.position.set(side*.18,sheep?.96:.94,-.86);
      for(const end of [-1,1]){const leg=this.mesh(new THREE.CylinderGeometry(.06,.07,.45,5),3,group);leg.position.set(side*.3,.23,end*.4);group.userData.legs.push(leg);}
    }
    if(!sheep){const tail=this.mesh(new THREE.ConeGeometry(.12,.65,6),0,group);tail.position.set(0,.65,.75);tail.rotation.x=.8;}
    outlineMeshes(group);return group;
  }
  dog(){return this.animal(false);}
  fence(x,z,w,d,parent=this.world){
    const horizontal=w>d,n=Math.ceil(Math.max(w,d)/1.5);
    for(let i=0;i<=n;i++){const post=this.mesh(new THREE.BoxGeometry(.12,1.1,.12),1,parent);post.position.set(x+(horizontal?w*i/n:0),.55,z+(horizontal?0:d*i/n));}
    for(const y of [.35,.8]){const rail=this.mesh(new THREE.BoxGeometry(Math.max(.1,w),.08,Math.max(.1,d)),1,parent);rail.position.set(x+w/2,y,z+d/2);}
  }
  load(game){
    const dispose=o=>{o.geometry?.dispose();for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])if(!this.materials.includes(m))m.dispose();};
    this.world.traverse(dispose);this.world.clear();
    for(const model of this.flock){model.traverse(dispose);this.scene.remove(model);}this.flock=game.sheep.map(s=>this.animal(true,s.id));
    this.level=game.level;
    for(const r of game.config.fences)this.fence(r.x,r.z,r.w,r.d);
    this.fence(-15,-20,30,.08);this.fence(-15,20,30,.08);this.fence(-15,-20,.08,40);this.fence(15,-20,.08,40);
    this.fence(-4,-19,8,.1);this.fence(-4,-19,.1,5);this.fence(4,-19,.1,5);
    const pen=this.mesh(new THREE.PlaneGeometry(8,5),2,this.world);pen.rotation.x=-Math.PI/2;pen.position.set(0,.01,-16.5);
    if(game.config.river){for(const side of [-1,1]){const river=this.mesh(new THREE.BoxGeometry(11.7,.03,4),1,this.world);river.position.set(side*9.15,-.02,0);}
      for(let i=0;i<12;i++){const plank=this.mesh(new THREE.BoxGeometry(6.6,.1,.32),0,this.world);plank.position.set(0,.02,-2+i*.36);}this.fence(-3.3,-2,.1,4);this.fence(3.3,-2,.1,4);}
    this.gate=new THREE.Group();this.world.add(this.gate);if(game.level===2)this.fence(1.5,-5,7,.3,this.gate);
    if(game.level===2){const post=this.mesh(new THREE.BoxGeometry(.25,1.4,.25),2,this.world);post.position.set(game.lever.x,.7,game.lever.z);const handle=this.mesh(new THREE.BoxGeometry(.7,.12,.12),2,this.world);handle.position.set(game.lever.x,1.4,game.lever.z);}
    this.tractor=new THREE.Group();this.world.add(this.tractor);
    const hood=this.mesh(new THREE.BoxGeometry(1.8,.9,1.1),2,this.tractor);hood.position.y=.7;
    const cab=this.mesh(new THREE.BoxGeometry(.7,1,.9),0,this.tractor);cab.position.set(-.4,1.5,0);
    for(const x of [-.65,.65])for(const z of [-.65,.65]){const wheel=this.mesh(new THREE.CylinderGeometry(.4,.4,.2,10),3,this.tractor);wheel.rotation.x=Math.PI/2;wheel.position.set(x,.4,z);}
    const barn=this.mesh(new THREE.BoxGeometry(4,3,4),0,this.world);barn.position.set(10,1.5,-16);
    const roof=this.mesh(new THREE.ConeGeometry(3.4,2,4),2,this.world);roof.rotation.y=Math.PI/4;roof.position.set(10,4,-16);
    for(const [x,z] of [[-11,-13],[-12,13],[12,12]]){const trunk=this.mesh(new THREE.CylinderGeometry(.2,.25,2,6),3,this.world);trunk.position.set(x,1,z);const leaves=this.mesh(new THREE.IcosahedronGeometry(1.5,1),0,this.world);leaves.position.set(x,2.7,z);}
    outlineMeshes(this.world);
  }
  setLobby(value){this.lobby=value;}
  resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}
  aimAt(x,y){const r=this.canvas.getBoundingClientRect();this.ray.setFromCamera({x:(x-r.left)/r.width*2-1,y:1-(y-r.top)/r.height*2},this.camera);if(!this.ray.ray.intersectPlane(this.plane,this.point))return null;return{x:clamp(this.point.x,-14,14),z:clamp(this.point.z,-19,19)};}
  render(game,dt=0,time=0){
    if(this.level!==game.level||this.flock.length!==game.sheep.length)this.load(game);
    const p=game.player,models=[this.players[0],...this.flock],bodies=[p,...game.sheep];
    models.forEach((m,i)=>{const b=bodies[i];m.visible=!b.lost;m.position.set(b.x,Math.sin(time*10+i)*Math.min(.06,Math.hypot(b.vx,b.vz)*.02),b.z);m.rotation.y=-b.angle;
      m.userData.legs.forEach((leg,j)=>leg.rotation.x=Math.sin(time*11+j%2*Math.PI)*Math.min(.5,Math.hypot(b.vx,b.vz)*.2));});
    this.target.position.set(game.aim.x,.025,game.aim.z);this.target.visible=game.stage==='playing';
    this.ring.visible=game.barkRing>0||game.whistleTime>0;this.ring.position.set(p.x,.04,p.z);this.ring.scale.setScalar(game.barkRing? (3+game.barkPower*6)*(1-game.barkRing/.5):9);
    this.gate.visible=game.level===2&&!game.gateOpen;this.tractor.visible=game.config.tractor;this.tractor.position.set(game.tractor.x,0,game.tractor.z);
    const portrait=this.camera.aspect<.8;this.camera.position.set(p.x+10,portrait?24:17,p.z+(portrait?24:18));this.camera.lookAt(p.x*.7,0,p.z-5);this.camera.updateMatrixWorld();
    this.renderer.render(this.scene,this.camera);
  }
}
