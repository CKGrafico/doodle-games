export const STEP=1/60, R=.24, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const CLUBS={driver:{label:'Driver',range:185,angle:25},iron:{label:'7 iron',range:108,angle:38},wedge:{label:'Wedge',range:48,angle:54},putter:{label:'Putter',range:26,angle:0}};
const hole=(name,par,tee,cup,route,water=[],sand=[],slope=[0,0])=>({name,par,tee:{x:tee[0],z:tee[1]},cup:{x:cup[0],z:cup[1]},route,water,sand,slope,green:11});
// A compact nine-hole parkland course. Coordinates are metres in an arcade scale.
export const HOLES=[
 hole('First impressions',3,[0,50],[-6,-47],[[0,50],[0,0],[-6,-47]],[],[[10,-38,6,9]], [.015,0]),
 hole('The long margin',4,[-9,83],[16,-83],[[-9,83],[-14,15],[16,-83]],[],[[-5,-57,10,7],[29,-76,5,9]],[0,.018]),
 hole('Mind the ink',3,[0,49],[4,-54],[[0,49],[10,-10],[4,-54]],[[0,-18,31,10]],[[-10,-50,5,8]],[-.013,.009]),
 hole('Dog-ear left',4,[24,79],[-27,-75],[[24,79],[16,28],[-25,-14],[-27,-75]],[[29,-31,17,25]],[[-9,-68,7,8]],[.013,.015]),
 hole('The scribble',5,[-17,116],[10,-117],[[-17,116],[-20,44],[20,-30],[10,-117]],[[23,37,15,19]],[[-3,-85,9,12],[24,-101,7,10]],[-.017,0]),
 hole('Pencil island',3,[0,52],[0,-48],[[0,52],[0,17],[0,-48]],[[0,-47,28,24]],[[9,-40,3,5]],[.008,-.012]),
 hole('Between the lines',4,[-22,82],[23,-91],[[-22,82],[-9,20],[23,-91]],[[24,10,17,28]],[[-10,-45,7,14],[10,-77,6,8]],[0,-.016]),
 hole('Bunker thoughts',4,[14,84],[-14,-88],[[14,84],[10,10],[-14,-88]],[],[[-6,-16,12,9],[18,-31,10,10],[-28,-75,7,12],[-1,-93,5,8]],[.014,.009]),
 hole('One last doodle',5,[15,120],[-8,-122],[[15,120],[-18,55],[-12,-12],[9,-73],[-8,-122]],[[0,-39,38,9]],[[-22,-108,8,11],[10,-112,7,8]],[-.009,.012])
];
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const ellipse=(p,e)=>((p.x-e[0])/e[2])**2+((p.z-e[1])/e[3])**2<=1;
function segmentDistance(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((p.x-a[0])*dx+(p.z-a[1])*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(p.x-a[0]-t*dx,p.z-a[1]-t*dz);}
export function lieAt(h,p){
 if(dist(p,h.cup)<h.green)return 'green';
 if(h.water.some(e=>ellipse(p,e)))return 'water';
 if(h.sand.some(e=>ellipse(p,e)))return 'bunker';
 if(Math.abs(p.x)>67||p.z>h.tee.z+27||p.z<h.cup.z-29)return 'out';
 if(h.route.slice(1).some((v,i)=>segmentDistance(p,h.route[i],v)<12))return 'fairway';
 return 'rough';
}
export function integrate(ball,dt,h,wind){
 const old={x:ball.x,y:ball.y,z:ball.z};
 const airborne=ball.y>R+.01||ball.vy>.05;
 if(airborne){ball.vx+=wind.x*.28*dt;ball.vz+=wind.z*.28*dt;ball.vy-=9.81*dt;}
 else{
   const lie=lieAt(h,ball),friction={green:1.05,fairway:2,rough:4.8,bunker:8,water:8,out:5}[lie];
   if(lie==='green'){ball.vx-=h.slope[0]*9.81*dt;ball.vz-=h.slope[1]*9.81*dt;}
   const speed=Math.hypot(ball.vx,ball.vz),next=Math.max(0,speed-friction*dt);if(speed){ball.vx*=next/speed;ball.vz*=next/speed;}
 }
 ball.x+=ball.vx*dt;ball.z+=ball.vz*dt;ball.y+=ball.vy*dt;
 if(ball.y<R){ball.y=R;ball.vy=Math.abs(ball.vy)*.28;ball.vx*=.73;ball.vz*=.73;if(ball.vy<1.1)ball.vy=0;}
 const lie=lieAt(h,ball);
 if(ball.y<=R+.1&&(lie==='water'||lie==='out'))return lie;
 if(ball.y<R+.3){
   const dx=ball.x-old.x,dz=ball.z-old.z,len=dx*dx+dz*dz,t=len?clamp(((h.cup.x-old.x)*dx+(h.cup.z-old.z)*dz)/len,0,1):0;
   if(Math.hypot(old.x+dx*t-h.cup.x,old.z+dz*t-h.cup.z)<.58&&Math.hypot(ball.vx,ball.vz)<4.1)return 'holed';
 }
 if(ball.y<=R+.01&&ball.vy===0&&Math.hypot(ball.vx,ball.vz)<.12){ball.vx=ball.vz=0;return 'rest';}
 return 'moving';
}
export function scoreName(strokes,par){const d=strokes-par;return strokes===1?'Hole in one!':d<=-3?'Albatross!':d===-2?'Eagle!':d===-1?'Birdie!':d===0?'Par. Nicely done.':d===1?'Bogey. Keep going.':d===2?'Double bogey':`${d} over par`;}
export class GolfGame{
 constructor({holes=9,wind='breeze'}={}){this.count=Number(holes);this.windMode=wind;this.scores=[];this.holeIndex=0;this.events=[];this.time=0;this.strokes=0;this.totalPenalties=0;this.loadHole();}
 get hole(){return HOLES[this.holeIndex];}
 get lie(){return lieAt(this.hole,this.ball);}
 get distance(){return dist(this.ball,this.hole.cup);}
 get total(){return this.scores.reduce((a,s)=>a+s,0);}
 get par(){return HOLES.slice(0,this.scores.length).reduce((a,h)=>a+h.par,0);}
 loadHole(){this.ball={...this.hole.tee,y:R,vx:0,vy:0,vz:0};this.lastSafe={...this.ball};this.strokes=0;this.stage='aim';this.shotTime=0;const n=this.holeIndex;const strength=this.windMode==='calm'?0:this.windMode==='gusty'?5:2;this.wind={x:Math.sin(n*2.2+.7)*strength,z:Math.cos(n*1.7+.5)*strength*.7};this.message=this.hole.name;this.prepare();this.events.push({type:'hole'});}
 prepare(){this.angle=Math.atan2(this.hole.cup.x-this.ball.x,this.hole.cup.z-this.ball.z);this.club=this.lie==='green'?'putter':this.distance>135?'driver':this.distance>58?'iron':'wedge';if(this.lie==='bunker')this.club='wedge';this.power=clamp(Math.sqrt(this.distance/(CLUBS[this.club].range*1.07)),.1,1);}
 launch(){const c=CLUBS[this.club],lie=this.lie,factor=lie==='bunker'?(this.club==='wedge'?.88:.48):lie==='rough'?.82:1;let speed,vy;
   if(this.club==='putter'){speed=Math.sqrt(2*1.05*c.range)*this.power;vy=0;}else{const a=c.angle*Math.PI/180,v=Math.sqrt(c.range*9.81/Math.sin(2*a))*this.power*factor;speed=v*Math.cos(a);vy=v*Math.sin(a);}
   return {...this.ball,vx:Math.sin(this.angle)*speed,vz:Math.cos(this.angle)*speed,vy};
 }
 shoot(){if(this.stage!=='aim')return false;this.lastSafe={...this.ball};this.ball=this.launch();this.strokes++;this.stage='flight';this.shotTime=0;this.events.push({type:'swing',club:this.club});return true;}
 penalty(reason){this.strokes++;this.totalPenalties++;this.ball={...this.lastSafe,vx:0,vy:0,vz:0};this.stage='aim';this.message=reason==='water'?'Splash. One penalty stroke; replay your shot.':'Out of bounds. One penalty stroke; replay your shot.';this.prepare();this.events.push({type:'penalty',reason});}
 finish(){this.ball={...this.hole.cup,y:-.15,vx:0,vy:0,vz:0};this.scores.push(this.strokes);this.stage='holed';this.message=scoreName(this.strokes,this.hole.par);this.events.push({type:'holed',strokes:this.strokes,par:this.hole.par});}
 next(){if(this.stage!=='holed')return false;if(this.holeIndex+1>=this.count){this.stage='over';return false;}this.holeIndex++;this.loadHole();return true;}
 step(dt){this.time+=dt;if(this.stage!=='flight')return;this.shotTime+=dt;const result=integrate(this.ball,dt,this.hole,this.wind);if(result==='water'||result==='out'){this.penalty(result);return;}if(result==='holed'){this.finish();return;}if(result==='rest'||this.shotTime>25){this.ball.vx=this.ball.vy=this.ball.vz=0;this.ball.y=R;this.stage='aim';this.message='Your next shot.';this.prepare();this.events.push({type:'rest'});}}
 preview(){const key=[this.holeIndex,this.ball.x,this.ball.y,this.ball.z,this.club,this.power,this.angle,this.wind.x,this.wind.z].join('|');if(this.previewKey===key)return this.previewValue;let ball=this.launch(),path=[{...ball}],result='moving';for(let i=0;i<1500;i++){result=integrate(ball,STEP,this.hole,this.wind);if(i%8===0)path.push({...ball});if(result!=='moving')break;}path.push({...ball});this.previewKey=key;this.previewValue={path,end:ball,result};return this.previewValue;}
 drainEvents(){return this.events.splice(0);}
}
