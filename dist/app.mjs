import { calculate, crossover, defaultState, openingComplete, premiseDefaults, machineDefaults, seasons, threshold, winterCheck } from './calc.mjs';

const root = document.getElementById('app');
const storageKey = 'winter-strategy-comparator-v1';
let state;
try { state = JSON.parse(localStorage.getItem(storageKey)) || defaultState(); } catch { state = defaultState(); }
const h = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = x => Number.isFinite(x) ? (Math.round(x) === 0 ? '0' : Math.round(x).toLocaleString('en-US')) : '—';
const signed = x => `${x < 0 ? '−' : ''}Sh ${fmt(Math.abs(x))}`;
const money = x => `Sh ${fmt(x)}`;
const field = (label,path,value,opts={}) => `<div class="field"><label for="${h(path)}">${h(label)}</label><input id="${h(path)}" data-path="${h(path)}" type="${opts.type||'number'}" ${opts.step?`step="${opts.step}"`:''} ${opts.min!==undefined?`min="${opts.min}"`:''} value="${h(value)}" ${opts.placeholder?`placeholder="${h(opts.placeholder)}"`:''}></div>`;
const setDeep = (obj,path,value) => { const keys=path.split('.'); let at=obj; for(let i=0;i<keys.length-1;i++) at=at[keys[i]]; at[keys.at(-1)]=value; };
const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{ /* Calculations still work when browser storage is unavailable. */ }};
function machineOpening(){
  return state.opening.machines.map((m,i)=>`<div class="record machine-record">
    ${field('ID',`opening.machines.${i}.id`,m.id,{type:'text'})}
    <div class="field"><label for="opening.machines.${i}.type">Type</label><select id="opening.machines.${i}.type" data-path="opening.machines.${i}.type">${Object.keys(machineDefaults).map(t=>`<option value="${t}" ${String(m.type)===t?'selected':''}>Machine ${t}</option>`).join('')}</select></div>
    ${field('Life left',`opening.machines.${i}.life`,m.life,{min:0})}
    ${field('Maint. Sh',`opening.machines.${i}.maintenance`,m.maintenance,{min:0,placeholder:'Rate default'})}
    ${field('Deprec. Sh',`opening.machines.${i}.depreciation`,m.depreciation,{min:0,placeholder:'Rate default'})}
    <button class="iconbtn" title="Remove machine" aria-label="Remove machine ${h(m.id||i+1)}" data-remove-machine="${i}">×</button>
  </div>`).join('') || `<div class="emptyline">No machines entered. Add every machine still owned after Year 1.</div>`;
}
function loanOpening(){
  return state.opening.loans.map((l,i)=>`<div class="record loan">
    ${field('Loan ID',`opening.loans.${i}.id`,l.id,{type:'text'})}
    ${field('Debt Sh',`opening.loans.${i}.principal`,l.principal,{min:0})}
    ${field('Principal due Sh',`opening.loans.${i}.payment`,l.payment,{min:0})}
    ${field('Rate',`opening.loans.${i}.rate`,l.rate,{step:'0.01',min:0,placeholder:'Rate default'})}
    <button class="iconbtn" title="Remove loan" aria-label="Remove loan ${h(l.id||i+1)}" data-remove-loan="${i}">×</button>
  </div>`).join('') || `<div class="emptyline">No unpaid loans entered. Leave this empty if no debt remains.</div>`;
}
function planCard(plan,i){
  const id=i===0?'a':'b';
  return `<section class="card plan-card ${id}">
    <div class="cardhead"><div><div class="eyebrow">Year 2 winter proposal</div><div class="planname">${h(plan.name)}</div></div><button class="textbtn" data-copy="${i}">Copy other plan</button></div>
    <div class="planfields">
      ${field('Milk tons',`plans.${i}.milkTons`,plan.milkTons,{min:0,step:'1'})}
      ${field('Sales request · units',`plans.${i}.request`,plan.request,{min:0,step:'10000'})}
      ${field('Market investment · Sh',`plans.${i}.market`,plan.market,{min:0})}
      ${field('New loan · Sh',`plans.${i}.newLoan`,plan.newLoan,{min:0})}
      ${field('Loan term · seasons',`plans.${i}.loanTerm`,plan.loanTerm,{min:1,step:'1'})}
    </div>
    <div class="thinrule"></div>
    <div class="minihead"><h3>New machines bought</h3><span class="secondary">Count by type</span></div>
    <div class="purchase-grid">${Object.keys(machineDefaults).map(t=>field(`M${t}`,`plans.${i}.purchases.${t}`,plan.purchases[t]||0,{min:0,step:'1'})).join('')}</div>
    <div class="minihead"><h3>Premises, machine use and production</h3><span class="secondary">Each machine fits one slot</span></div>
    <div class="premise-list">${Object.keys(premiseDefaults).map(key=>{
      const p=plan.premises[key];return `<div class="premise"><div class="premise-top"><label class="check"><input type="checkbox" data-check="plans.${i}.premises.${key}.rented" ${p.rented?'checked':''}>${key}</label><span class="secondary">${money(Number(state.rates.premises[key].rent))} rent · Sh ${h(state.rates.premises[key].transport)} transport / sold unit</span>${p.rented?field('Produced',`plans.${i}.premises.${key}.production`,p.production,{min:0,step:'1'}):'<span class="secondary">Not rented</span>'}</div>
      ${p.rented?`<div class="premise-detail">${Object.keys(machineDefaults).map(t=>field(`M${t}`,`plans.${i}.premises.${key}.machines.${t}`,p.machines[t]||0,{min:0,step:'1'})).join('')}</div>`:''}</div>`;
    }).join('')}</div>
  </section>`;
}
function status(result){
  if(!openingComplete(state.opening))return `<div class="notice">Year 2 opening position is incomplete. Plan totals below are provisional.</div>`;
  if(result.problems.length===0)return `<div class="pill">No rule or cash warnings</div>${result.notices.map(n=>`<div class="notice">${h(n)}</div>`).join('')}`;
  return result.problems.map(x=>`<div class="problem">${h(x)}</div>`).join('')+result.notices.map(n=>`<div class="notice">${h(n)}</div>`).join('');
}
const metric=(label,a,b,major=false)=>`<div class="metric-row ${major?'major':''}"><span>${label}</span><span>${a}</span><span>${b}</span></div>`;
function comparison(ra,rb){
  const rows=[
    ['Actual sales',fmt(ra.allocation),fmt(rb.allocation)],
    ['Revenue',money(ra.pnl.revenue),money(rb.pnl.revenue)],
    ['Milk bought',money(ra.pnl.milk),money(rb.pnl.milk)],
    ['Rent',money(ra.pnl.rent),money(rb.pnl.rent)],
    ['Transport',money(ra.pnl.transport),money(rb.pnl.transport)],
    ['Market spending',money(ra.pnl.market),money(rb.pnl.market)],
    ['Maintenance + depreciation',money(ra.pnl.maintenance+ra.pnl.depreciation),money(rb.pnl.maintenance+rb.pnl.depreciation)],
    ['Loan interest',money(ra.pnl.interest),money(rb.pnl.interest)],
    ['Machine purchases · cash',money(ra.cash.purchases),money(rb.cash.purchases)],
    ['Unused milk capacity · units',fmt(ra.unusedMilk),fmt(rb.unusedMilk)],
    ['Unsold ice creams',fmt(ra.unsold),fmt(rb.unsold)],
    ['Net profit',money(ra.pnl.net),money(rb.pnl.net),true],
    ['Cash after advances',money(ra.cash.afterMarket),money(rb.cash.afterMarket)],
    ['Closing cash',money(ra.cash.closing),money(rb.cash.closing),true],
    ['Debt remaining',money(ra.debtClosing),money(rb.debtClosing)],
    ['Tax losses remaining',money(ra.pnl.closingLoss),money(rb.pnl.closingLoss)],
  ];
  return `<div class="metric-row head"><span>Measure</span><span>Plan A</span><span>Plan B</span></div>${rows.map(x=>metric(...x)).join('')}`;
}
function differences(a,b){
  const candidates=[
    ['actual sales',b.allocation-a.allocation,'units'],
    ['revenue',b.pnl.revenue-a.pnl.revenue],['milk',b.pnl.milk-a.pnl.milk],
    ['rent',b.pnl.rent-a.pnl.rent],['transport',b.pnl.transport-a.pnl.transport],
    ['market spending',b.pnl.market-a.pnl.market],
    ['maintenance',b.pnl.maintenance-a.pnl.maintenance],
    ['depreciation',b.pnl.depreciation-a.pnl.depreciation],
    ['interest',b.pnl.interest-a.pnl.interest],
    ['machine purchases paid in cash',b.cash.purchases-a.cash.purchases]
  ].filter(x=>x[1]!==0).sort((x,y)=>Math.abs(y[1])-Math.abs(x[1])).slice(0,4);
  if(!candidates.length)return `<p class="secondary">These plans have the same main financial drivers for this sales scenario.</p>`;
  return `<ul class="diff-list">${candidates.map(([label,v,unit])=>`<li>Plan B has ${unit==='units'?fmt(Math.abs(v)):money(Math.abs(v))} ${v>0?'more':'less'} ${h(label)}${unit==='units'?' allocated':''}.</li>`).join('')}</ul>`;
}
function statement(title,rows){return `<div class="card statement"><h3>${title}</h3><table><tbody>${rows.map(([label,value,kind])=>`<tr class="${kind||''}"><td>${label}</td><td>${money(value)}</td></tr>`).join('')}</tbody></table></div>`;}
function statements(result,name){const p=result.pnl,c=result.cash;return `<div class="statement-grid">
  ${statement(`${name} · profit and loss`,[
    ['Revenue',p.revenue],['Milk bought',-p.milk],['Maintenance',-p.maintenance],['Depreciation',-p.depreciation],['Gross profit',p.gross,'subtotal'],
    ['Transport',-p.transport],['Market investment',-p.market],['Bonus',-p.bonus],['Fixed salaries',-p.salary],['Rent',-p.rent],['Loan interest',-p.interest],
    ['Profit before tax',p.beforeTax,'subtotal'],['Tax loss used',p.lossUsed],['Taxable profit',p.taxable],['Game tax',-p.tax],['Net profit',p.net,'total']
  ])}
  ${statement(`${name} · cash flow`,[
    ['Opening cash',c.opening],['Loan received',c.loanAmount],['Machine purchase',-c.purchases],['Milk purchase',-c.milk],['Market investment',-c.market],
    ['Cash after advance payments',c.afterMarket,'subtotal'],['Sales receipt',c.revenue],['Rent',-c.rent],['Maintenance',-c.maintenance],['Transport',-c.transport],['Fixed salaries',-c.salary],
    ['Bonus',-c.bonus],['Bank principal',-c.principal],['Bank interest',-c.interest],['Game tax',-c.tax],['Closing cash',c.closing,'total']
  ])}</div>`;}
function rateFields(){
  const r=state.rates;
  const keys=[['Milk cost / ton','milkCost'],['Milk yield / ton','milkYield'],['Sales price / unit','salePrice'],['Minimum milk tons','minMilk'],['Minimum market Sh','minMarket'],['Fixed salaries Sh','salary'],['Bonus rate','bonusRate'],['Tax rate','taxRate'],['Interest rate','interestRate']];
  return `<div class="rategrid">${keys.map(([label,k])=>field(label,`rates.${k}`,r[k],{step:['bonusRate','taxRate','interestRate','salePrice'].includes(k)?'0.01':'1',min:0})).join('')}</div>
    <div class="divider-heading">Premises · editable Year 1 estimates</div>
    ${Object.keys(r.premises).map(k=>`<div class="ratesline"><strong>Premise ${k}</strong>${field('Slots',`rates.premises.${k}.slots`,r.premises[k].slots,{min:0})}${field('Rent Sh',`rates.premises.${k}.rent`,r.premises[k].rent,{min:0})}${field('Transport Sh',`rates.premises.${k}.transport`,r.premises[k].transport,{step:'0.01',min:0})}</div>`).join('')}
    <div class="divider-heading">Machines · editable Year 1 estimates</div>
    ${Object.keys(r.machines).map(t=>`<div class="ratesline machine"><strong>M${t}</strong>${field('Capacity',`rates.machines.${t}.capacity`,r.machines[t].capacity,{min:0})}${field('Purchase Sh',`rates.machines.${t}.price`,r.machines[t].price,{min:0})}${field('Maint. Sh',`rates.machines.${t}.maintenance`,r.machines[t].maintenance,{min:0})}${field('Deprec. Sh',`rates.machines.${t}.depreciation`,r.machines[t].depreciation,{min:0})}</div>`).join('')}`;
}
function render(){
  const ratesOpen = root.querySelector('details')?.open || false;
  const fixture=winterCheck();
  const complete=openingComplete(state.opening);
  const winterOnly=state.opening.basis==='winter-example';
  const allocA=state.allocations[state.scenario]?.[0] ?? 0,allocB=state.allocations[state.scenario]?.[1] ?? 0;
  const ra=calculate(state,0,allocA),rb=calculate(state,1,allocB);
  const ta=threshold(state,0),tb=threshold(state,1),cross=crossover(state);
  root.innerHTML=`<header class="topbar"><div class="topinner"><div class="brand"><span class="mark">W</span><div><h1>Winter Strategy Comparator</h1><div class="topmeta">Pork &amp; Garlic Ice Cream Co. · Year 2 winter</div></div></div><div class="topmeta">Your entries stay in this browser<br>Year 1 prices are estimates for Year 2</div></div></header>
  <main class="shell">
    <div class="intro"><div><h2>Choose a winter plan with the cash consequences in view</h2><p>Use a Winter-only illustration now, or enter your real position after Year 1 autumn when it becomes available. Then compare Plans A and B.</p></div><span class="tag ${complete&&!winterOnly?'ok':'warn'}">${winterOnly?'Winter-only illustration':complete?'Actual opening entered':'Opening position incomplete'}</span></div>
    <div class="topgrid">
      <section class="card"><div class="cardhead"><div><div class="eyebrow">1 · Starting point</div><h2>${winterOnly?'Winter-only illustration':'After Year 1 autumn'}</h2><p>${winterOnly?'This uses the known Year 1 Winter closing position only. Three intervening seasons are unknown, so these Year 2 projections are illustrations.':'Use final Year 1 accounts when available. If your class has only completed Winter, use the illustration button below.'}</p></div></div>
        <div class="opening-actions"><button class="textbtn" data-use-winter>Use known Winter as illustration</button>${winterOnly?'<button class="textbtn" data-use-actual>Switch to actual Year 1 end position</button>':''}</div>
        <div class="fields">${field(winterOnly?'Winter closing cash · Sh':'Autumn closing cash · Sh','opening.cash',state.opening.cash,{placeholder:'Required'})}${field(winterOnly?'Profit through Winter · Sh':'Year 1 annual profit · Sh','opening.annualProfit',state.opening.annualProfit,{placeholder:'Required'})}${field('Tax loss carried · Sh','opening.taxLoss',state.opening.taxLoss,{min:0,placeholder:'Enter 0 if none'})}</div>
        <div class="minihead"><h3>Machines still owned</h3><button class="textbtn" data-add-machine>Add machine</button></div>${machineOpening()}
        <div class="minihead"><h3>Unpaid loans</h3><button class="textbtn" data-add-loan>Add loan</button></div>${loanOpening()}
        <p class="inline-note">For each loan, enter the principal due this winter. Interest is calculated on its opening debt.</p>
      </section>
      <aside class="card"><div class="eyebrow">Calculation check</div><h2>Known Year 1 winter</h2><p class="secondary">This historical case checks the accounting engine. It does not set the Year 2 opening cash.</p>
        <div class="fixture"><strong>${fixture.pass?'All six figures match':'Calculation check failed'}</strong><div class="fixture-grid">
          ${[['Revenue',fixture.revenue],['Gross profit',fixture.gross],['Profit before tax',fixture.beforeTax],['Game tax',fixture.tax],['Net profit',fixture.net],['Closing cash',fixture.cash]].map(([k,v])=>`<div><span>${k}</span><strong>${money(v)}</strong></div>`).join('')}
        </div></div><p class="inline-note">Based on 40,000 sold, two tons of milk, Premise D, Machine 5 and Sh 1,000 market investment.</p>
      </aside>
    </div>
    <section class="section" id="compare"><div class="sectionhead"><div><div class="eyebrow">2 · Sales uncertainty</div><h2>Enter possible actual allocations</h2><p>These are scenario assumptions. The trainer will decide actual sales in class.</p></div>${field('Year 2 forecast · optional','rates.forecast',state.rates.forecast,{placeholder:'Enter when known',min:0})}</div>
      <div class="card"><div class="scenarios"><span class="secondary">Scenario</span><span class="field-label">Plan A actual sales</span><span class="field-label">Plan B actual sales</span>
      ${seasons.map((name,i)=>`<div class="scenario-row"><button class="scenario-tab ${state.scenario===i?'active':''}" data-scenario="${i}" aria-pressed="${state.scenario===i}">${name}</button><div class="scenario-alloc"><input aria-label="${name} actual sales for Plan A" type="number" min="0" step="1" data-path="allocations.${i}.0" value="${h(state.allocations[i][0])}"></div><div class="scenario-alloc"><input aria-label="${name} actual sales for Plan B" type="number" min="0" step="1" data-path="allocations.${i}.1" value="${h(state.allocations[i][1])}"></div></div>`).join('')}
      </div><p class="allocation-note">For a fair comparison, start with the same allocation in both columns. You can enter different values to test different trainer outcomes.</p></div>
    </section>
    <section class="section"><div class="sectionhead"><div><div class="eyebrow">3 · Choices</div><h2>Edit the two plans</h2><p>Draft premises and production are examples. Replace them with your proposed Year 2 choices.</p></div></div><div class="plan-grid">${state.plans.map(planCard).join('')}</div></section>
    <section class="section" id="results"><div class="sectionhead"><div><div class="eyebrow">4 · Financial consequences</div><h2>${seasons[state.scenario]} allocation comparison</h2><p>Each line uses posted whole shekels. Red warnings identify plans that cannot be relied on.</p></div></div>
      <div class="result-grid"><div class="card">${comparison(ra,rb)}</div><div class="card"><h3>What changes between the plans</h3>${allocA!==allocB?'<div class="notice">The sales allocations differ. Revenue differences may reflect the scenario, not the decision itself.</div>':''}${differences(ra,rb)}<div class="thinrule"></div><h3>Cash-safe sales threshold</h3><p class="secondary">Lowest 10,000-unit allocation that leaves advance and closing cash nonnegative, if the rest of the plan is valid.</p><p><strong>Plan A:</strong> ${ta===null?'Not available':fmt(ta)+' units'}<br><strong>Plan B:</strong> ${tb===null?'Not available':fmt(tb)+' units'}</p><p class="secondary">First common allocation where Plan B earns more net profit: <strong>${cross===null?'None in the feasible range':fmt(cross)+' units'}</strong>. These are financial tests, not market predictions.</p></div></div>
      <div class="section statuscols"><div class="card"><h3>Plan A checks</h3>${status(ra)}<p class="secondary">Advance cash: after loan ${money(ra.cash.afterLoan)} → machine ${money(ra.cash.afterMachines)} → milk ${money(ra.cash.afterMilk)} → market ${money(ra.cash.afterMarket)}</p></div><div class="card"><h3>Plan B checks</h3>${status(rb)}<p class="secondary">Advance cash: after loan ${money(rb.cash.afterLoan)} → machine ${money(rb.cash.afterMachines)} → milk ${money(rb.cash.afterMilk)} → market ${money(rb.cash.afterMarket)}</p></div></div>
      <div class="section">${statements(ra,'Plan A')}</div><div class="section">${statements(rb,'Plan B')}</div>
      <div class="section card"><h2>Your recommendation</h2><p class="secondary">Record your preferred plan and the sales assumption that matters most. Check the lower allocation before deciding.</p><textarea class="recommendation" id="recommendation" placeholder="Example: I prefer Plan A if at least 30,000 ice creams are sold because…">${h(state.recommendation)}</textarea></div>
    </section>
    <section class="section card"><details><summary>Year 2 assumptions · edit when the professor gives new rules</summary><p class="secondary">These are Year 1 values used as provisional estimates. The forecast is entered separately above and never generates sales automatically.</p>${rateFields()}</details></section>
    <footer class="footer">Browser-only working copy · No sign-in or database · Verify final decisions against the trainer’s Year 2 rules</footer>
  </main>`;
  if (!complete) root.querySelector('#results').innerHTML = `<div class="sectionhead"><div><div class="eyebrow">4 · Financial consequences</div><h2>Choose an opening position</h2><p>Use the Winter illustration above if Autumn is not yet available, or enter the actual Year 1 end position when you have it.</p></div></div><div class="card"><p class="secondary">The six Winter check figures alone do not establish the real Year 2 opening balances.</p></div>`;
  if (ratesOpen) root.querySelector('details').open = true;
}

root.addEventListener('change', e=>{
  const el=e.target;
  if(el.dataset.path){ setDeep(state,el.dataset.path,el.value); save(); render(); }
  else if(el.dataset.check){ setDeep(state,el.dataset.check,el.checked); save(); render(); }
});
root.addEventListener('input', e=>{if(e.target.id==='recommendation'){state.recommendation=e.target.value;save();}});
root.addEventListener('click', e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-add-machine'))state.opening.machines.push({id:`M${state.opening.machines.length+1}`,type:5,life:4,maintenance:'',depreciation:''});
  else if(b.hasAttribute('data-use-winter'))state.opening={basis:'winter-example',cash:76796,annualProfit:1296,taxLoss:0,machines:[{id:'Winter M5',type:5,life:7,maintenance:1300,depreciation:3500}],loans:[]};
  else if(b.hasAttribute('data-use-actual'))state.opening={basis:'actual',cash:'',annualProfit:'',taxLoss:'',machines:[],loans:[]};
  else if(b.hasAttribute('data-remove-machine'))state.opening.machines.splice(Number(b.dataset.removeMachine),1);
  else if(b.hasAttribute('data-add-loan'))state.opening.loans.push({id:`L${state.opening.loans.length+1}`,principal:'',payment:'',rate:''});
  else if(b.hasAttribute('data-remove-loan'))state.opening.loans.splice(Number(b.dataset.removeLoan),1);
  else if(b.hasAttribute('data-scenario'))state.scenario=Number(b.dataset.scenario);
  else if(b.hasAttribute('data-copy')){const i=Number(b.dataset.copy);const other=i===0?1:0;state.plans[i]=structuredClone(state.plans[other]);state.plans[i].name=i===0?'Plan A':'Plan B';}
  else return;
  save();render();
});
render();
