export const POOL=Object.freeze({halfWidth:10,halfLength:15,goalHalfWidth:1.5,goalHeight:.9,ballRadius:.22,twoMetre:13,fiveMetre:10});
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const attackDirection=team=>team===0?-1:1;
export const FORMATION=[[-7,10],[0,8],[7,10],[-5,3],[5,3],[0,-2]];
export const shotClockExpired=seconds=>seconds<=0;
export function classifyBall(ball){if(Math.abs(ball.z)>POOL.halfLength+POOL.ballRadius){const end=Math.sign(ball.z),attacking=end<0?0:1;if(Math.abs(ball.x)<POOL.goalHalfWidth&&ball.y<POOL.goalHeight+.25)return{type:'goal',team:attacking};return{type:'goal-throw',team:1-attacking};}if(Math.abs(ball.x)>POOL.halfWidth+POOL.ballRadius)return{type:'out'};return null;}
