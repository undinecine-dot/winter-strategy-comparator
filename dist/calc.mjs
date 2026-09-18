export const seasons = ['Low', 'Expected', 'High'];
export const premiseDefaults = {
  A: { slots: 1, rent: 12000, transport: 0.3 },
  B: { slots: 1, rent: 10000, transport: 0.4 },
  C: { slots: 1, rent: 12000, transport: 0.3 },
  D: { slots: 1, rent: 17000, transport: 0.1 },
  E: { slots: 2, rent: 15000, transport: 0.2 },
  F: { slots: 3, rent: 16000, transport: 0.2 },
};
export const machineDefaults = {
  1: { capacity: 72000, price: 35000, maintenance: 1800, depreciation: 4375 },
  2: { capacity: 120000, price: 95000, maintenance: 2900, depreciation: 11875 },
  3: { capacity: 68000, price: 38000, maintenance: 2100, depreciation: 4750 },
  4: { capacity: 95000, price: 70000, maintenance: 2900, depreciation: 8750 },
  5: { capacity: 45000, price: 28000, maintenance: 1300, depreciation: 3500 },
  6: { capacity: 110000, price: 90000, maintenance: 2900, depreciation: 11250 },
};
export const defaultRates = {
  milkCost: 20000, milkYield: 20000, salePrice: 2, minMilk: 1,
  minMarket: 1000, salary: 10000, bonusRate: 0.05, taxRate: 0.1,
  interestRate: 0.1, forecast: '', premises: structuredClone(premiseDefaults),
  machines: structuredClone(machineDefaults),
};
export const blankPremises = () => Object.fromEntries(Object.keys(premiseDefaults).map(k => [k, { rented: false, production: 0, machines: {} }]));
export const draftPlan = (name, premise) => {
  const premises = blankPremises();
  premises[premise] = { rented: true, production: 40000, machines: { 5: 1 } };
  return { name, milkTons: 2, request: 40000, market: 1000, newLoan: 0, loanTerm: 4, purchases: {}, premises };
};
export const defaultState = () => ({
  rates: structuredClone(defaultRates),
  opening: { cash: '', annualProfit: '', taxLoss: '', machines: [], loans: [] },
  plans: [draftPlan('Plan A', 'D'), draftPlan('Plan B', 'E')],
  allocations: [[20000, 20000], [30000, 30000], [40000, 40000]],
  scenario: 1, recommendation: '',
});
const num = x => Number.isFinite(Number(x)) ? Number(x) : 0;
const money = x => Math.round(x);
const sum = a => a.reduce((x, y) => x + y, 0);
const positive = x => Math.max(0, x);

export function winterCheck() {
  const test = defaultState();
  test.opening = { cash: 100000, annualProfit: 0, taxLoss: 0, machines: [], loans: [] };
  test.plans[0].purchases = { 5: 1 };
  const { pnl, cash: flow, problems } = calculate(test, 0, 40000);
  const { revenue, gross, beforeTax, tax, net } = pnl;
  const cash = flow.closing;
  return { revenue, gross, beforeTax, tax, net, cash,
    pass: problems.length === 0 && revenue === 80000 && gross === 35200 && beforeTax === 1440 && tax === 144 && net === 1296 && cash === 76796 };
}

export function openingComplete(opening) {
  return ['cash', 'annualProfit', 'taxLoss'].every(k => opening[k] !== '' && opening[k] !== null && Number.isFinite(Number(opening[k])));
}

export function calculate(state, planIndex, allocation) {
  const plan = state.plans[planIndex], r = state.rates, opening = state.opening;
  const problems = [], notices = [];
  if (!openingComplete(opening)) problems.push('Enter Year 1 autumn cash, annual profit and tax loss first.');
  if (num(opening.cash) < 0) problems.push('Year 1 autumn closing cash cannot be negative.');
  if (num(opening.taxLoss) < 0) problems.push('Carried tax loss cannot be negative.');
  const milkTons = num(plan.milkTons), request = num(plan.request), market = num(plan.market), sales = num(allocation);
  if (milkTons < num(r.minMilk)) problems.push(`Milk must be at least ${r.minMilk} ton.`);
  if (!Number.isInteger(milkTons)) problems.push('Milk tons must be a whole number.');
  if (market < num(r.minMarket)) problems.push(`Market investment must be at least Sh ${money(num(r.minMarket)).toLocaleString()}.`);
  if (request < 0 || request % 10000 !== 0) problems.push('Sales request must be a nonnegative multiple of 10,000.');
  if (sales < 0 || !Number.isInteger(sales)) problems.push('Actual sales allocation must be a nonnegative whole number.');
  const entries = Object.keys(r.premises).map(key => {
    const p = plan.premises[key] || { rented: false, production: 0, machines: {} };
    const counts = Object.fromEntries(Object.keys(r.machines).map(t => [t, num(p.machines?.[t])]));
    const slots = sum(Object.values(counts)), production = num(p.production);
    const capacity = sum(Object.entries(counts).map(([t, count]) => count * num(r.machines[t]?.capacity)));
    if (slots > (p.rented ? num(r.premises[key].slots) : 0)) problems.push(`${key}: machines exceed rented slots.`);
    if (production > capacity) problems.push(`${key}: production exceeds installed machine capacity.`);
    if (production > 0 && !p.rented) problems.push(`${key}: production is in an unrented premise.`);
    if (!Number.isInteger(production) || production < 0 || slots < 0 || Object.values(counts).some(x => !Number.isInteger(x) || x < 0)) problems.push(`${key}: enter nonnegative whole machine counts and production.`);
    return { key, rented: !!p.rented, counts, production, capacity, rent: p.rented ? money(num(r.premises[key].rent)) : 0, rate: num(r.premises[key].transport) };
  });
  const totalProduction = sum(entries.map(x => x.production));
  const milkCapacity = milkTons * num(r.milkYield);
  if (totalProduction > milkCapacity) problems.push('Planned production exceeds milk yield.');
  if (request > totalProduction) problems.push('Sales request exceeds planned production.');
  if (sales > request) problems.push('Actual sales allocation exceeds the request.');
  if (sales > totalProduction) problems.push('Actual sales allocation exceeds production.');
  const available = Object.fromEntries(Object.keys(r.machines).map(t => [t, 0]));
  const owned = opening.machines || [];
  let maintenance = 0, depreciation = 0;
  for (const m of owned) {
    const t = String(m.type);
    if (m.life === '' || m.life == null || !Number.isInteger(num(m.life)) || num(m.life) < 0 || num(m.life) > 8) problems.push(`Opening machine ${m.id || ''}: enter remaining life from 0 to 8.`);
    if (!r.machines[t]) { problems.push(`Opening machine ${m.id || ''} has an unknown type.`); continue; }
    if (num(m.life) > 0) available[t] += 1;
    maintenance += money(m.maintenance === '' || m.maintenance == null ? num(r.machines[t].maintenance) : num(m.maintenance));
    if (num(m.life) > 0) depreciation += money(m.depreciation === '' || m.depreciation == null ? num(r.machines[t].depreciation) : num(m.depreciation));
  }
  let purchases = 0;
  for (const t of Object.keys(r.machines)) {
    const count = num(plan.purchases?.[t]);
    if (!Number.isInteger(count) || count < 0) problems.push(`Machine ${t}: purchase count must be a nonnegative whole number.`);
    available[t] += count;
    purchases += money(count * num(r.machines[t].price));
    maintenance += money(count * num(r.machines[t].maintenance));
    depreciation += money(count * num(r.machines[t].depreciation));
    const assigned = sum(entries.map(e => e.counts[t]));
    if (assigned > available[t]) problems.push(`Machine ${t}: ${assigned} assigned, ${available[t]} available.`);
  }
  const loanAmount = num(plan.newLoan), loanTerm = num(plan.loanTerm);
  if (loanAmount < 0) problems.push('New loan cannot be negative.');
  if (loanAmount > 0 && (!Number.isInteger(loanTerm) || loanTerm < 1 || loanTerm > 8)) problems.push('New loan term must be 1–8 seasons.');
  const newPrincipal = loanAmount > 0 && loanTerm > 0 ? money(loanAmount / loanTerm) : 0;
  const newInterest = money(loanAmount * num(r.interestRate));
  let oldPrincipal = 0, oldInterest = 0;
  for (const loan of opening.loans || []) {
    if (loan.principal === '' || loan.payment === '') problems.push(`Opening loan ${loan.id || ''}: enter debt and principal due this winter.`);
    if (num(loan.principal) < 0 || num(loan.payment) < 0 || num(loan.payment) > num(loan.principal)) problems.push(`Opening loan ${loan.id || ''}: check principal and winter payment.`);
    oldPrincipal += money(num(loan.payment));
    oldInterest += money(num(loan.principal) * (loan.rate === '' || loan.rate == null ? num(r.interestRate) : num(loan.rate)));
  }
  const principal = oldPrincipal + newPrincipal, interest = oldInterest + newInterest;
  let assignedSales = 0;
  const producing = entries.filter(e => e.production > 0);
  entries.forEach(e => { e.sold = 0; e.transport = 0; });
  producing.forEach((e, i) => {
    e.sold = i === producing.length - 1 ? sales - assignedSales : money(sales * e.production / totalProduction);
    assignedSales += e.sold;
    e.transport = money(e.sold * e.rate);
  });
  const rent = sum(entries.map(e => e.rent)), transport = sum(entries.map(e => e.transport));
  const milk = money(milkTons * num(r.milkCost)), marketCost = money(market);
  const revenue = money(sales * num(r.salePrice));
  const gross = revenue - milk - maintenance - depreciation;
  const bonus = money(positive(gross) * num(r.bonusRate));
  const salary = money(num(r.salary));
  const beforeTax = gross - transport - marketCost - bonus - salary - rent - interest;
  const lossUsed = Math.min(positive(beforeTax), num(opening.taxLoss));
  const taxable = positive(beforeTax - lossUsed);
  const tax = money(taxable * num(r.taxRate));
  const net = beforeTax - tax;
  const closingLoss = num(opening.taxLoss) - lossUsed + positive(-beforeTax);
  const openingCash = num(opening.cash);
  const afterLoan = openingCash + loanAmount;
  const afterMachines = afterLoan - purchases;
  const afterMilk = afterMachines - milk;
  const afterMarket = afterMilk - marketCost;
  const closingCash = afterMarket + revenue - rent - maintenance - transport - salary - bonus - principal - interest - tax;
  const advance = [afterLoan, afterMachines, afterMilk, afterMarket];
  if (advance.some(x => x < 0)) problems.push('Cash is negative before all advance payments are complete.');
  if (closingCash < 0) problems.push('Closing cash is negative.');
  if (totalProduction > sales) notices.push(`${(totalProduction - sales).toLocaleString()} unsold ice creams spoil.`);
  if (milkCapacity > totalProduction) notices.push(`${(milkCapacity - totalProduction).toLocaleString()} ice creams of unused milk capacity spoil.`);
  if (r.forecast === '' || r.forecast == null) notices.push('Year 2 forecast is not entered; allocation remains your scenario assumption.');
  return { problems, notices, valid: problems.length === 0, allocation: sales, entries,
    production: totalProduction, milkCapacity, unusedMilk: milkCapacity - totalProduction, unsold: totalProduction - sales,
    pnl: { revenue, milk, maintenance, depreciation, gross, transport, market: marketCost, bonus, salary, rent, interest, beforeTax, openingLoss: num(opening.taxLoss), lossUsed, taxable, tax, net, closingLoss },
    cash: { opening: openingCash, loanAmount, revenue, purchases, milk, market: marketCost, rent, maintenance, transport, salary, bonus, principal, interest, tax, afterLoan, afterMachines, afterMilk, afterMarket, closing: closingCash, lowestAdvance: Math.min(...advance) },
    debtClosing: sum((opening.loans || []).map(l => positive(num(l.principal) - num(l.payment)))) + positive(loanAmount - newPrincipal),
  };
}

export function threshold(state, planIndex) {
  if (!openingComplete(state.opening)) return null;
  const plan = state.plans[planIndex];
  const max = Math.min(num(plan.request), sum(Object.values(plan.premises).map(p => num(p.production))));
  for (let sales = 0; sales <= max; sales += 10000) {
    const result = calculate(state, planIndex, sales);
    if (result.valid) return sales;
  }
  return null;
}

export function crossover(state) {
  if (!openingComplete(state.opening)) return null;
  const max = Math.min(...state.plans.map(p => Math.min(num(p.request), sum(Object.values(p.premises).map(x => num(x.production))))));
  for (let sales = 0; sales <= max; sales += 10000) {
    const a = calculate(state, 0, sales), b = calculate(state, 1, sales);
    if (a.valid && b.valid && b.pnl.net > a.pnl.net) return sales;
  }
  return null;
}
