const classPts = {A1:18,A2:11,B1:5,B2:1};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const round1=v=>Math.round(v*10)/10;
const validNum=v=>v!=="" && v!==null && v!==undefined && Number.isFinite(Number(v));

export function evaluateBoats(boats, stage="post"){
  const exTimes = boats.filter(b=>validNum(b.exTime)).map(b=>Number(b.exTime)).sort((a,b)=>a-b);
  const stVals = boats.filter(b=>validNum(b.exST)).map(b=>Math.abs(Number(b.exST))).sort((a,b)=>a-b);
  return boats.map(b=>{
    let s=0;
    s += classPts[b.class] ?? 0;
    s += clamp((Number(b.national)-4)*5,0,20);
    s += clamp((Number(b.local)-4)*2.2,0,9);
    s += clamp(Number(b.courseWin)*0.22,0,18);
    s += clamp((Number(b.motor2)-20)*0.32,0,12);
    s += clamp(Number(b.recent)*0.08,0,8);
    // インの構造的優位。コース実績が強い場合だけ増える。
    if(b.lane===1) s += 6 + clamp((Number(b.courseWin)-50)*0.08,0,4);
    if(stage==="post" && validNum(b.exTime)){
      const rank=exTimes.indexOf(Number(b.exTime));
      s += [5.5,4,2.8,1.6,.7,0][rank] ?? 0;
    }
    // 展示STは補助指標。踏み込みを評価するが比重は小さい。
    if(stage==="post" && validNum(b.exST)){
      const rank=stVals.indexOf(Math.abs(Number(b.exST)));
      s += [2.2,1.7,1.2,.8,.4,0][rank] ?? 0;
      if(Number(b.exST)<0) s -= .2; // F展示を過大評価しない
    }
    return {...b,score:round1(s)};
  }).sort((a,b)=>b.score-a.score);
}

function weights(evaluated){
  return evaluated.map(b=>({lane:b.lane,w:Math.exp(b.score/14)}));
}

export function trifectaProbabilities(evaluated){
  const ws=weights(evaluated); const combos=[];
  for(const a of ws){
    const sum1=ws.reduce((s,x)=>s+x.w,0); const p1=a.w/sum1;
    const rem2=ws.filter(x=>x.lane!==a.lane); const sum2=rem2.reduce((s,x)=>s+x.w,0);
    for(const b of rem2){
      const p2=b.w/sum2; const rem3=rem2.filter(x=>x.lane!==b.lane); const sum3=rem3.reduce((s,x)=>s+x.w,0);
      for(const c of rem3){ combos.push({combo:`${a.lane}-${b.lane}-${c.lane}`,prob:p1*p2*(c.w/sum3)}); }
    }
  }
  return combos.sort((a,b)=>b.prob-a.prob);
}

export function winProbabilities(evaluated){
  const ws=weights(evaluated),sum=ws.reduce((s,x)=>s+x.w,0);
  return ws.map(x=>({lane:x.lane,prob:x.w/sum})).sort((a,b)=>b.prob-a.prob);
}

export function assessRace(evaluated, combos){
  const wins=winProbabilities(evaluated);
  const top=wins[0].prob;
  const top6=combos.slice(0,6).reduce((s,x)=>s+x.prob,0);
  const leadGap=evaluated[0].score-evaluated[1].score;
  let confidence=2;
  if(top>=.42) confidence++;
  if(top>=.50 && leadGap>=4) confidence++;
  if(top6>=.50) confidence++;
  confidence=clamp(confidence,1,5);
  const buy = confidence>=4 || (confidence===3 && top>=.48);
  return {buy,confidence,topWin:top,topLane:wins[0].lane,leadGap,top6};
}

const ceil100=v=>Math.ceil(v/100)*100;

export function buildBetPlan({combos,odds,budget=2000,targetReturn=1.10,buy=true}){
  const candidates=combos.slice(0,12).map(x=>({...x,odds:Number(odds[x.combo])||0}));
  if(!buy) return {status:"watch",bets:[],used:0,note:"自信度が基準未満のため見送り。"};
  const main=candidates.filter(x=>x.odds>0).slice(0,2);
  if(main.length<2) return {status:"need-odds",bets:[],used:0,note:"上位候補のオッズを2点以上入力してください。"};
  const target=budget*targetReturn;
  const bets=[]; let used=0;
  for(const m of main){
    const amt=Math.max(100,ceil100(target/m.odds));
    bets.push({...m,amount:amt,type:"本線"}); used+=amt;
  }
  if(used>budget){
    return {status:"watch",bets:[],used:0,note:"本線2点をガミらない配分にすると予算超過。見送り推奨。"};
  }
  let left=budget-used;
  // 残額は「確率×オッズ」が比較的高い候補を優先。最低100円。
  const holes=candidates.slice(2).filter(x=>x.odds>0).map(x=>({...x,value:x.prob*x.odds})).sort((a,b)=>b.value-a.value);
  for(const h of holes){
    if(left<100) break;
    const amt=100;
    bets.push({...h,amount:amt,type:h.value>=1?"穴":"押さえ"}); used+=amt; left-=amt;
  }
  // 余りは最上位本線へ100円ずつ追加
  let i=0;
  while(left>=100){bets[i%main.length].amount+=100; used+=100; left-=100; i++;}
  return {status:"buy",bets,used,note:"本線の最低払戻を確保し、残額を期待値順に100円単位で配分。"};
}
