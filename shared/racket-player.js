import * as THREE from '../vendor/three.module.min.js';
const PAPER = 0xf7f4e9;
// Original padel characters, reused by the racket-sport family.
export function makeRacketPlayer(view, color, id, { perforated = true } = {}) {
    const root=new THREE.Group();root.rotation.y=id<2?Math.PI:0;view.scene.add(root);
    const body=new THREE.Group();root.add(body);
    const torso=view.mesh(new THREE.CapsuleGeometry(.245,.35,4,9),color,.36,true);torso.position.y=1.03;body.add(torso);
    const shorts=view.box(.45,.24,.32,color,.75);shorts.position.y=.73;body.add(shorts);
    const head=view.mesh(new THREE.SphereGeometry(.24,12,9),color,.015,true);head.scale.set(.93,1.1,.96);head.position.y=1.59;body.add(head);
    const hair=view.mesh(new THREE.SphereGeometry(.247,12,8,0,Math.PI*2,0,1.28),color,.7,true);hair.position.copy(head.position);body.add(hair);
    const band=view.mesh(new THREE.CylinderGeometry(.248,.248,.062,16),color,.07);band.position.y=1.69;body.add(band);
    for(const x of [-.074,.074]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.019,6,5),new THREE.MeshBasicMaterial({color}));eye.position.set(x,1.6,.218);body.add(eye);}
    const legs=[];
    for(const x of [-.14,.14]) {
      const leg=new THREE.Group();leg.position.set(x,.65,0);body.add(leg);
      const shin=view.mesh(new THREE.CapsuleGeometry(.075,.33,3,7),color,.015,true);shin.position.y=-.25;leg.add(shin);
      const shoe=view.mesh(new THREE.BoxGeometry(.18,.12,.31),color,.45);shoe.position.set(0,-.57,.05);leg.add(shoe);legs.push(leg);
    }
    const arms=[];
    for(const x of [-.31,.31]) {
      const arm=new THREE.Group();arm.position.set(x,1.2,0);body.add(arm);
      const limb=view.mesh(new THREE.CapsuleGeometry(.066,.35,3,7),color,.02,true);limb.position.set(Math.sign(x)*.025,-.24,.045);limb.rotation.x=-.18;arm.add(limb);arms.push(arm);
    }
    const racket=new THREE.Group();racket.position.set(.06,-.51,.14);arms[1].add(racket);racket.rotation.x=-.18;racket.rotation.z=-.22;
    const handle=view.box(.065,.24,.065,color,.8);racket.add(handle);
    const face=view.mesh(new THREE.CylinderGeometry(.225,.215,.055,16),color,.43,true);face.rotation.x=Math.PI/2;face.scale.y=1;face.scale.z=1.25;face.position.y=-.33;racket.add(face);
    if (perforated) for(let x=-.12;x<=.12;x+=.08)for(let y=-.47;y<=-.2;y+=.075) {
      if((x/.18)**2+((y+.33)/.22)**2>1)continue;
      const hole=new THREE.Mesh(new THREE.CircleGeometry(.018,6),new THREE.MeshBasicMaterial({color:PAPER,side:THREE.DoubleSide}));hole.position.set(x,y,.038);racket.add(hole);
    }
    const shadow=view.disk(.33,color,.12);shadow.position.y=.025;root.add(shadow);
    return {root,body,legs,arms,id};
  }

export function animateRacketPlayers(models, game, dt, time) {
  models.forEach((model,i)=>{
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
}
