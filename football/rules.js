export const FIELD=Object.freeze({halfWidth:34,halfLength:52.5,goalHalfWidth:3.66,goalHeight:2.44,penaltyDepth:16.5,penaltyHalfWidth:20.16,goalAreaDepth:5.5,goalAreaHalfWidth:9.16,centreRadius:9.15,ballRadius:.3});
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const direction=(team,half=1)=>(team===0?-1:1)*(half===1?1:-1);
export const opposite=team=>1-team;
export const FORMATIONS={
  '433':[[0,-.92],[-.72,-.55],[-.25,-.63],[.25,-.63],[.72,-.55],[-.45,-.18],[0,-.31],[.45,-.18],[-.73,.33],[0,.45],[.73,.33]],
  '442':[[0,-.92],[-.72,-.55],[-.25,-.63],[.25,-.63],[.72,-.55],[-.72,-.1],[-.25,-.21],[.25,-.21],[.72,-.1],[-.25,.4],[.25,.4]]
};
export function classifyExit(ball,lastTouch,half=1) {
  if(Math.abs(ball.z)-FIELD.ballRadius>FIELD.halfLength){
    const end=Math.sign(ball.z);
    const attackingTeam=direction(0,half)===end?0:1;
    if(Math.abs(ball.x)+FIELD.ballRadius<FIELD.goalHalfWidth && ball.y+FIELD.ballRadius<FIELD.goalHeight)return {type:'goal',team:attackingTeam};
    const defendingTeam=1-attackingTeam;
    return lastTouch===defendingTeam?{type:'corner',team:attackingTeam,end}:{type:'goal-kick',team:defendingTeam,end};
  }
  if(Math.abs(ball.x)-FIELD.ballRadius>FIELD.halfWidth)return {type:'throw-in',team:1-lastTouch,side:Math.sign(ball.x)};
  return null;
}
// Position is assessed when the pass is played. An offence is awarded only
// when a flagged receiver plays the ball. Restarts have the stated exemptions.
export function offsidePlayers(players,ball,team,half=1,restart=null) {
  if(['throw-in','corner','goal-kick'].includes(restart))return [];
  const d=direction(team,half);
  const defenders=players.filter(p=>p.team!==team).map(p=>p.z*d).sort((a,b)=>b-a);
  const line=Math.max(ball.z*d,defenders[1]??FIELD.halfLength);
  return players.filter(p=>p.team===team && p.z*d>0 && p.z*d>line+.3).map(p=>p.id);
}
