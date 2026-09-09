import * as THREE from '../vendor/three.module.min.js';
import { penMaterial, outlineMeshes } from './ink.js';
const BLUE=0x2a42ad, RED=0xc94b59;
export class RideView {
  constructor(canvas,kind){
    this.canvas=canvas;this.kind=kind;this.width=1;this.height=1;this.lobby=true;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.setClearColor(0xf7f4e9,0);
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog(0xf7f4e9,48,110);
    this.camera=new THREE.PerspectiveCamera(48,1,.1,150);this.camera.position.set(0,13,19);
    this.materials=[penMaterial(BLUE,.04),penMaterial(BLUE,.45),penMaterial(RED,.5)];
    this.track=new THREE.Mesh(new THREE.PlaneGeometry(24,130,24,65),this.materials[0]);
    this.track.rotation.x=-Math.PI/2;this.track.position.z=-42;this.scene.add(this.track);
    if(kind==='ski'){
      const positions=this.track.geometry.attributes.position;
      for(let i=0;i<positions.count;i++)positions.setZ(i,-(positions.getY(i)+42)*.12);
      positions.needsUpdate=true;this.track.geometry.computeVertexNormals();
    }
    this.rider=new THREE.Group();this.scene.add(this.rider);
    this.body=this.mesh(new THREE.CapsuleGeometry(.3,.65,4,8),1,this.rider);this.body.position.y=1.25;
    const head=this.mesh(new THREE.SphereGeometry(.28,12,8),0,this.rider);head.position.y=2.1;
    for(const side of [-1,1]){
      const leg=this.mesh(new THREE.CapsuleGeometry(.1,.55,3,7),1,this.rider);leg.position.set(side*.23,.55,0);leg.rotation.z=side*.15;
      const arm=this.mesh(new THREE.CapsuleGeometry(.085,.65,3,7),0,this.rider);arm.position.set(side*.53,1.45,0);arm.rotation.z=side*.8;
      if(kind==='ski'){
        const ski=this.mesh(new THREE.BoxGeometry(.18,.08,2.5),2,this.rider);ski.position.set(side*.26,.12,0);
        const pole=this.mesh(new THREE.CylinderGeometry(.025,.025,1.65,6),1,this.rider);pole.position.set(side*.8,.7,.3);pole.rotation.x=-.25;
      }
    }
    if(kind==='surf'){
      const board=this.mesh(new THREE.SphereGeometry(1,16,8),2,this.rider);board.scale.set(.48,.09,1.6);board.position.y=.12;
    }
    outlineMeshes(this.rider);
    this.gateModels=[];
    if(kind==='ski')for(let i=0;i<20;i++){
      const group=new THREE.Group();this.scene.add(group);
      for(const side of [-1,1]){const pole=this.mesh(new THREE.CylinderGeometry(.045,.045,2,6),i%2?1:2,group);pole.position.set(side*2,1,0);const flag=this.mesh(new THREE.BoxGeometry(.75,.42,.04),i%2?1:2,group);flag.position.set(side*1.65,1.55,0);}
      this.gateModels.push(group);
    }
    this.rocks=Array.from({length:5},()=>{const rock=this.mesh(new THREE.DodecahedronGeometry(.8),1);rock.scale.y=.8;return rock;});
    this.rocks.forEach(rock=>rock.visible=kind==='ski');
    this.sides=[];
    for(let i=0;i<28;i++){
      const tree=new THREE.Group();this.scene.add(tree);tree.position.set((i%2?1:-1)*(kind==='surf'?7.4:10+(i%3)),0,0);
      if(kind==='ski') {const trunk=this.mesh(new THREE.CylinderGeometry(.1,.15,1,6),1,tree);trunk.position.y=.5;const crown=this.mesh(new THREE.ConeGeometry(.8,2.5,7),0,tree);crown.position.y=2;}
      else {const buoy=this.mesh(new THREE.SphereGeometry(.22,8,6),2,tree);buoy.position.y=.25;}
      this.sides.push(tree);
    }
    this.pocket=this.mesh(new THREE.TorusGeometry(1.1,.045,5,28),2);this.pocket.rotation.x=-Math.PI/2;this.pocket.visible=kind==='surf';
    this.resize();
  }
  mesh(geometry,index=0,parent=this.scene){const mesh=new THREE.Mesh(geometry,this.materials[index]);parent.add(mesh);return mesh;}
  setLobby(value){this.lobby=value;}
  resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.width=r.width;this.height=r.height;this.renderer.setSize(r.width,r.height,false);this.camera.aspect=r.width/r.height;this.camera.updateProjectionMatrix();}
  render(game,dt=0,time=0){
    const surf=this.kind==='surf';
    if(surf){
      const positions=this.track.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getY(i);positions.setZ(i,.06*x*x+.35*Math.sin(z*.5+game.z*.3));}
      positions.needsUpdate=true;this.track.geometry.computeVertexNormals();
      this.pocket.position.set(game.pocket,.06*game.pocket**2+.6,-5);
    }
    const jump=game.air?Math.sin(Math.PI*(1-game.air/game.airDuration))*1.8:0;
    this.rider.position.set(game.x,(surf ? .06*game.x**2+.35*Math.sin(-21+game.z*.3) : 0)+jump,0);
    this.rider.rotation.z=-game.vx*.055;this.rider.rotation.y=-game.vx*.035;
    this.rider.visible=!game.recovery||Math.floor(time*8)%2===0;
    this.body.rotation.x=game.speed/100;
    for(let i=0;i<this.sides.length;i++){
      this.sides[i].position.z=10-((i*5+game.z)%140);
      this.sides[i].position.y=surf ? .06*7.4**2 : this.sides[i].position.z*.12;
    }
    if(!surf){
      game.gates.forEach((gate,i)=>{const model=this.gateModels[i],z=-(gate.z-game.z);model.position.set(gate.x,z*.12,z);model.visible=gate.z-game.z>-12&&gate.z-game.z<100;});
      game.rocks.forEach((rock,i)=>{const z=-(rock.z-game.z);this.rocks[i].position.set(rock.x,.5+z*.12,z);});
    }
    const portrait=this.camera.aspect<.8;
    this.camera.position.lerp(new THREE.Vector3(game.x*.25,portrait?19:13,portrait?25:19),1-Math.exp(-Math.max(dt,.001)*5));
    this.camera.lookAt(game.x*.2,0,-10);this.renderer.render(this.scene,this.camera);
  }
}
