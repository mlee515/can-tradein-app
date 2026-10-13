const C = require('./config');
const up = s => (s || '').toString().trim().toUpperCase();

function baseMsrp(v) {
  const make = up(v.make), model = up(v.model);
  let msrp, src;
  if (C.msrpByModel[`${make}|${model}`]) { msrp = C.msrpByModel[`${make}|${model}`]; src = 'model table'; }
  else {
    const bc = (C.msrpByBodyClass.find(([k]) => (v.bodyClass || '').includes(k)) || [])[1];
    msrp = bc || C.defaultMsrp; src = bc ? `body class (${v.bodyClass})` : 'default';
    if (C.luxuryMakeMultiplier[make]) { msrp *= C.luxuryMakeMultiplier[make]; src += ` × luxury ${C.luxuryMakeMultiplier[make]}`; }
  }
  return { msrp: Math.round(msrp), src };
}

function builtinEstimate(v, { mileage, condition, zip }) {
  const now = new Date(); const year = +v.year;
  // model year typically on sale ~Oct prior year
  const age = Math.max(0, now.getFullYear() - year + (now.getMonth() >= 9 ? 0.5 : 0) - 0.5);
  const { msrp, src } = baseMsrp(v);
  const curve = C.depreciationCurve; const ai = Math.floor(age), frac = age - ai;
  const at = i => i < curve.length ? curve[i] : curve[curve.length - 1] * Math.pow(C.depreciationYearlyTail, i - curve.length + 1);
  let ageFactor = at(ai) + (at(ai + 1) - at(ai)) * frac;
  ageFactor *= (C.makeRetention[up(v.make)] || 1);
  const expected = Math.max(age, 0.25) * C.mileage.expectedPerYear;
  const diffK = (expected - mileage) / 1000;
  const mileageFactor = 1 + Math.min(C.mileage.maxBonus, Math.max(-C.mileage.maxPenalty, diffK * C.mileage.adjPer1kMiles));
  const cond = C.conditions[condition]; const zipF = (zip && C.zipAdjustments[zip.slice(0, 3)]) || 1;
  const retail = msrp * ageFactor * mileageFactor * cond.mult * zipF;
  const point = Math.max(C.floorValue, retail * C.tradeInFactor);
  const r = x => Math.round(x / C.roundTo) * C.roundTo;
  return {
    provider: 'builtin', low: r(point * (1 - C.rangeSpread)), high: r(point * (1 + C.rangeSpread)), point: r(point),
    breakdown: { baseMsrp: msrp, msrpSource: src, ageYears: +age.toFixed(1), ageFactor: +ageFactor.toFixed(3),
      expectedMiles: Math.round(expected), mileageFactor: +mileageFactor.toFixed(3), conditionFactor: cond.mult,
      zipFactor: zipF, tradeInFactor: C.tradeInFactor },
  };
}

// ---- Adapters: implement & set config.provider to switch to a licensed data source ----
const adapters = {
  builtin: builtinEstimate,
  async blackbook(v, input) { throw new Error('Black Book adapter not configured (needs API key/contract)'); },
  async kbbico(v, input) { throw new Error('KBB Instant Cash Offer adapter not configured'); },
  async marketcheck(v, input) { throw new Error('MarketCheck adapter not configured (MARKETCHECK_API_KEY)'); },
};
async function estimate(v, input) {
  try { return await adapters[C.provider](v, input); }
  catch (e) { console.error('Provider failed, falling back to builtin:', e.message); return builtinEstimate(v, input); }
}
module.exports = { estimate, builtinEstimate };
