import {sampleRace} from "./sample-race.js";
import {evaluateBoats,trifectaProbabilities,winProbabilities,assessRace,buildBetPlan} from "./engine.js";
import {getHistory,addHistory,clearHistory} from "./store.js";

let race=structuredClone(sampleRace),budget=2000,lastPlan=null,lastAssessment=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

function renderBoatTable(){
  const tbody=$("#boatTable tbody");tbody.innerHTML="";
  race.boats.forEach((b,i)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><span class="lane lane-${b.lane}">${b.lane}</span></td>
      <td><input class="name" data-k="name" data-i="${i}" value="${b.name}"></td>
      <td><select data-k="class" data-i="${i}">${["A1","A2","B1","B2"].map(x=>`<option ${x===b.class?"selected":""}>${x}</option>`).join("")}</select></td>
      ${["national","local","courseWin","motor2","recent","exTime","exST"].map(k=>`<td><input type="number" step="0.01" data-k="${k}" data-i="${i}" value="${b[k]??""}"></td>`).join("")}`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll("input,select").forEach(el=>el.addEventListener("change",e=>{
    const i=+e.target.dataset.i,k=e.target.dataset.k; race.boats[i][k]=k==="name"||k==="class"?e.target.value:Number(e.target.value); recalc();
  }));
}

function renderOdds(combos){
  const top=combos.slice(0,12); const root=$("#oddsGrid");root.innerHTML="";
  top.forEach(x=>{
    const box=document.createElement("div"); box.className="odds-item";
    box.innerHTML=`<label>${x.combo} <span class="muted">${(x.prob*100).toFixed(1)}%</span></label><input type="number" step="0.1" min="0" value="${race.odds[x.combo]??""}" data-combo="${x.combo}" placeholder="オッズ">`;
    root.appendChild(box);
  });
  root.querySelectorAll("input").forEach(el=>el.addEventListener("change",e=>{race.odds[e.target.dataset.combo]=Number(e.target.value);recalc(false)}));
}

function recalc(refreshOdds=true){
  const evals=evaluateBoats(race.boats,race.stage),combos=trifectaProbabilities(evals),wins=winProbabilities(evals),assessment=assessRace(evals,combos);
  lastAssessment=assessment;
  $("#raceTitle").textContent=`${race.venue} ${race.raceNo}R`;
  $("#raceMeta").textContent=`${race.stage==="post"?"展示後":"展示前"} / ${race.fixedEntry?"進入固定":"進入固定なし"}`;
  $("#stageTag").textContent=race.stage==="post"?"展示後":"展示前";
  $("#topBoat").textContent=`${assessment.topLane}号艇`;
  $("#topWinProb").textContent=`${(assessment.topWin*100).toFixed(1)}%`;
  $("#confidenceStars").textContent="★".repeat(assessment.confidence)+"☆".repeat(5-assessment.confidence);
  const badge=$("#decisionBadge");badge.textContent=assessment.buy?"買い":"見";badge.classList.toggle("watch",!assessment.buy);
  $("#raceReason").textContent=assessment.buy
    ? `上位艇の優位が比較的明確。トップ艇の推定1着率 ${(assessment.topWin*100).toFixed(1)}%、上位6点集中度 ${(assessment.top6*100).toFixed(1)}%。`
    : `上位差が小さく買い目が広がりやすい。トップ艇の推定1着率 ${(assessment.topWin*100).toFixed(1)}%。丸亀5R級の自信度には未達。`;

  const ranking=$("#boatRanking");ranking.innerHTML="";
  evals.forEach((b,idx)=>{
    const wp=wins.find(x=>x.lane===b.lane)?.prob??0;
    const el=document.createElement("div");el.className="ranking-item";
    el.innerHTML=`<span class="lane lane-${b.lane}">${b.lane}</span><div><strong>${idx===0?"◎ ":idx===1?"○ ":idx===2?"▲ ":idx===3?"△ ":""}${b.name}</strong><div class="meter"><i style="width:${Math.min(100,b.score)}%"></i></div></div><div class="rank-score"><strong>${b.score}</strong><span>1着 ${(wp*100).toFixed(1)}%</span></div>`;
    ranking.appendChild(el);
  });
  if(refreshOdds) renderOdds(combos);
  const target=Number($("#targetReturn").value)||1.1;
  lastPlan=buildBetPlan({combos,odds:race.odds,budget,targetReturn:target,buy:assessment.buy});
  renderPlan(lastPlan);
}

function renderPlan(plan){
  const root=$("#betPlan");root.innerHTML="";
  if(!plan.bets.length){root.innerHTML=`<p class="reason">${plan.note}</p>`;return}
  plan.bets.forEach(b=>{
    const payout=b.odds?Math.round(b.amount*b.odds):0;
    const el=document.createElement("div");el.className="bet-row";
    el.innerHTML=`<div><div class="combo">${b.combo}</div><div class="label">${b.type}</div></div><div><strong>${b.odds?b.odds.toFixed(1)+"倍":"--"}</strong><div class="label">的中時 約${payout.toLocaleString()}円</div></div><div class="bet-amount">${b.amount.toLocaleString()}円</div>`;
    root.appendChild(el);
  });
  const total=document.createElement("div");total.className="bet-row";total.innerHTML=`<div><strong>合計</strong></div><div class="label">${plan.note}</div><div class="bet-amount">${plan.used.toLocaleString()}円</div>`;root.appendChild(total);
}

function renderStats(){
  const h=getHistory(), bought=h.filter(x=>x.decision==="買い"), stake=bought.reduce((s,x)=>s+x.investment,0), ret=bought.reduce((s,x)=>s+x.returnAmount,0), hits=bought.filter(x=>x.returnAmount>0).length;
  const roi=stake?ret/stake*100:0;
  $("#statsCards").innerHTML=[
    ["購入レース",`${bought.length}R`],["的中率",bought.length?`${(hits/bought.length*100).toFixed(1)}%`:"--"],["回収率",stake?`${roi.toFixed(1)}%`:"--"],["収支",`${(ret-stake).toLocaleString()}円`]
  ].map(([a,b])=>`<div class="stat-card"><span>${a}</span><strong>${b}</strong></div>`).join("");
  $("#historyBody").innerHTML=h.map(x=>`<tr><td>${x.date}</td><td>${x.race}</td><td>${x.decision}</td><td>${x.investment.toLocaleString()}円</td><td>${x.result||"-"}</td><td>${x.returnAmount.toLocaleString()}円</td><td>${(x.returnAmount-x.investment).toLocaleString()}円</td></tr>`).join("") || `<tr><td colspan="7" class="muted">まだ履歴がありません</td></tr>`;
}

$$('.tab').forEach(btn=>btn.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.remove('is-active'));$$('.tab-panel').forEach(x=>x.classList.remove('is-active'));btn.classList.add('is-active');$(`#panel-${btn.dataset.tab}`).classList.add('is-active');if(btn.dataset.tab==='stats')renderStats()}));
$("#budgetButtons").addEventListener("click",e=>{const b=e.target.dataset.budget;if(!b)return;budget=Number(b);$$('#budgetButtons button').forEach(x=>x.classList.toggle('is-active',x.dataset.budget===b));recalc(false)});
$("#recalcBtn").addEventListener("click",()=>recalc(false));
$("#targetReturn").addEventListener("change",()=>recalc(false));
$("#loadSampleBtn").addEventListener("click",()=>{race=structuredClone(sampleRace);renderBoatTable();recalc(true)});
$("#clearExhibitionBtn").addEventListener("click",()=>{race.stage="pre";race.boats.forEach(b=>{b.exTime="";b.exST=""});renderBoatTable();recalc(true)});
$("#saveResultBtn").addEventListener("click",()=>{
  const result=$("#resultCombo").value.trim(),p100=Number($("#payout100").value)||0;
  let ret=0; if(lastPlan?.bets?.length){const hit=lastPlan.bets.find(x=>x.combo===result);if(hit)ret=(hit.amount/100)*p100}
  addHistory({date:new Date().toLocaleString('ja-JP'),race:`${race.venue} ${race.raceNo}R`,decision:lastAssessment?.buy?"買い":"見",investment:lastAssessment?.buy?(lastPlan?.used||0):0,result,returnAmount:ret,confidence:lastAssessment?.confidence||0});
  alert(`保存しました。払戻 ${ret.toLocaleString()}円`); renderStats();
});
$("#resetHistoryBtn").addEventListener("click",()=>{if(confirm("履歴を初期化しますか？")){clearHistory();renderStats()}});

renderBoatTable();recalc(true);renderStats();
