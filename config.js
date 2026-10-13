// ===== Central Avenue Nissan – Trade-In Estimator configuration =====
// Tune any number here; restart the server to apply.
module.exports = {
  dealer: { name: 'Central Avenue Nissan', city: 'Yonkers, NY', phone: '(914) 000-0000' },
  provider: 'builtin', // 'builtin' | 'blackbook' | 'kbbico' | 'marketcheck' (see valuation.js adapters)
  // Base MSRP (USD, new) by make+model. Falls back to body class, then default.
  msrpByModel: {
    'NISSAN|VERSA': 18500, 'NISSAN|SENTRA': 22000, 'NISSAN|ALTIMA': 28000, 'NISSAN|MAXIMA': 39000,
    'NISSAN|KICKS': 22000, 'NISSAN|ROGUE': 30000, 'NISSAN|ROGUE SPORT': 26000, 'NISSAN|MURANO': 37000,
    'NISSAN|PATHFINDER': 38000, 'NISSAN|ARMADA': 52000, 'NISSAN|FRONTIER': 32000, 'NISSAN|TITAN': 45000,
    'NISSAN|LEAF': 32000, 'NISSAN|ARIYA': 45000, 'NISSAN|370Z': 32000, 'NISSAN|Z': 42000,
    'TOYOTA|CAMRY': 28000, 'TOYOTA|COROLLA': 22000, 'TOYOTA|RAV4': 31000, 'TOYOTA|HIGHLANDER': 40000,
    'TOYOTA|TACOMA': 35000, 'HONDA|CIVIC': 25000, 'HONDA|ACCORD': 29000, 'HONDA|CR-V': 31000,
    'HONDA|PILOT': 40000, 'FORD|F-150': 45000, 'FORD|ESCAPE': 29000, 'FORD|EXPLORER': 40000,
    'CHEVROLET|SILVERADO': 45000, 'CHEVROLET|EQUINOX': 29000, 'CHEVROLET|MALIBU': 26000,
    'HYUNDAI|ELANTRA': 22000, 'HYUNDAI|TUCSON': 29000, 'HYUNDAI|SANTA FE': 33000,
    'KIA|FORTE': 21000, 'KIA|SPORTAGE': 29000, 'KIA|TELLURIDE': 40000,
    'JEEP|GRAND CHEROKEE': 42000, 'JEEP|WRANGLER': 38000, 'JEEP|CHEROKEE': 32000,
    'SUBARU|OUTBACK': 31000, 'SUBARU|FORESTER': 30000, 'MAZDA|CX-5': 30000, 'TESLA|MODEL 3': 42000, 'TESLA|MODEL Y': 48000,
  },
  msrpByBodyClass: [ // substring match on NHTSA BodyClass
    ['Pickup', 42000], ['Sport Utility', 34000], ['Crossover', 30000], ['Minivan', 38000],
    ['Van', 40000], ['Convertible', 40000], ['Coupe', 30000], ['Hatchback', 22000], ['Sedan', 26000],
  ],
  defaultMsrp: 28000,
  luxuryMakeMultiplier: { 'BMW': 1.6, 'MERCEDES-BENZ': 1.7, 'AUDI': 1.5, 'LEXUS': 1.45, 'INFINITI': 1.35, 'ACURA': 1.3, 'PORSCHE': 2.5, 'CADILLAC': 1.5, 'LINCOLN': 1.45, 'GENESIS': 1.4, 'VOLVO': 1.35 },
  // Retail value as fraction of MSRP by age in years (index = age). Beyond the end, apply yearlyTail per year.
  depreciationCurve: [0.88, 0.78, 0.70, 0.63, 0.57, 0.52, 0.47, 0.43, 0.39, 0.35, 0.32],
  depreciationYearlyTail: 0.92, floorValue: 1000,
  makeRetention: { 'TOYOTA': 1.06, 'HONDA': 1.05, 'SUBARU': 1.03, 'NISSAN': 1.0, 'JEEP': 1.0, 'CHRYSLER': 0.92, 'DODGE': 0.95 },
  mileage: { expectedPerYear: 12000, adjPer1kMiles: 0.004, maxPenalty: 0.35, maxBonus: 0.12 }, // ±0.4% per 1k miles vs expected
  conditions: {
    excellent: { label: 'Excellent', mult: 1.05, desc: 'Like new. No mechanical issues, clean history, no visible wear.' },
    good:      { label: 'Good',      mult: 1.00, desc: 'Minor wear, small scratches, everything works, tires/brakes OK.' },
    fair:      { label: 'Fair',      mult: 0.88, desc: 'Visible dents/scratches, some repairs or worn tires needed.' },
    poor:      { label: 'Poor',      mult: 0.70, desc: 'Major mechanical or body issues, warning lights, accident damage.' },
  },
  tradeInFactor: 0.82, // trade-in vs retail (covers recon, margin, holding cost)
  rangeSpread: 0.06,   // ±6% around the point estimate
  roundTo: 100,
  zipAdjustments: {}, // e.g. { '107': 1.02 } – first 3 digits of ZIP -> multiplier
};
