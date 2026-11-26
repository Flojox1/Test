import {
  SAVE_KEY, START_MONEY, BATCH_WEIGHT,
  MATERIALS, MUSHROOM_TYPES, BASE_RECIPE_COST, BATCH_YIELD_AVG,
  PHASES, METHODS, CONTAINER_LEVELS,
  STAR_SPEED, STAR_SALARY, MASTER_TYPES,
  MALE_NAMES, SURNAMES
} from './data.js';

/* ---------- YARDIMCI: BOŞ DURUM ---------- */
function freshInventory() {
  const inv = { mushroom: 0 };
  Object.keys(MATERIALS).forEach(k => { inv[k] = 0; });
  return inv;
}
function freshStock() {
  const st = {};
  Object.keys(MUSHROOM_TYPES).forEach(k => { st[k] = 0; });
  return st;
}
function freshDemand() {
  const d = {};
  Object.keys(MUSHROOM_TYPES).forEach(k => { d[k] = 1; });
  return d;
}
function makeFreshState() {
  return {
    money: START_MONEY,
    day: 1,
    tickCount: 0,
    speed: 1,
    inventory: freshInventory(),   // malzemeler (+ mushroom = toplam kg, stok ile senkron)
    stock: freshStock(),           // türe göre mantar stoku (kg)
    batches: [],
    containers: [{ id: 1, level: 1 }],
    masters: [],
    availableMasters: [],
    masterRestart: 'stop',
    masterMethod: 'hot',
    lastMasterRefreshDay: 0,
    market: { profitPerFlush: 174, materialMult: 1, mushroomPrice: 165, demand: freshDemand() },
    cart: {},
    lastTick: Date.now()
  };
}

export const state = makeFreshState();

/* ---------- KAYIT ---------- */
export function save() {
  try {
    state.lastTick = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {}
}

// Eski/eksik alanları tamamlar
function normalizeState() {
  if (!state.inventory || typeof state.inventory !== 'object') state.inventory = {};
  Object.keys(MATERIALS).forEach(k => {
    if (typeof state.inventory[k] !== 'number' || isNaN(state.inventory[k])) state.inventory[k] = 0;
  });
  if (typeof state.inventory.mushroom !== 'number') state.inventory.mushroom = 0;

  if (!state.stock || typeof state.stock !== 'object') {
    state.stock = {};
    if (state.inventory.mushroom > 0) state.stock.oyster = state.inventory.mushroom;
  }
  Object.keys(MUSHROOM_TYPES).forEach(k => {
    if (typeof state.stock[k] !== 'number' || isNaN(state.stock[k])) state.stock[k] = 0;
  });
  syncMushroomTotal();

  if (!state.cart) state.cart = {};
  if (!Array.isArray(state.containers) || !state.containers.length) state.containers = [{ id: 1, level: 1 }];
  if (!Array.isArray(state.masters)) state.masters = [];
  if (!Array.isArray(state.availableMasters)) state.availableMasters = [];
  if (!state.masterRestart) state.masterRestart = 'stop';
  if (!state.masterMethod) state.masterMethod = 'hot';
  if (!state.speed) state.speed = 1;

  if (!state.market || typeof state.market !== 'object') refreshMarket();
  if (!state.market.demand || typeof state.market.demand !== 'object') state.market.demand = freshDemand();
  Object.keys(MUSHROOM_TYPES).forEach(k => {
    if (typeof state.market.demand[k] !== 'number') state.market.demand[k] = 1;
  });
  if (!state.market.mushroomPrice) state.market.mushroomPrice = 165;

  state.batches.forEach(b => {
    if (!b.containerId) b.containerId = 1;
    if (!MUSHROOM_TYPES[b.mushroomType]) b.mushroomType = 'oyster';
    if (!METHODS[b.method]) b.method = 'hot';
    if (!Array.isArray(b.logs)) b.logs = [];
    if (!b.flush) b.flush = 1;
  });
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { refreshMasterPool(); refreshMarket(); return; }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.money === 'number' && Array.isArray(parsed.batches)) {
      Object.keys(state).forEach(k => delete state[k]);
      Object.assign(state, parsed);
      normalizeState();
      if (state.availableMasters.length === 0) refreshMasterPool();
      const elapsed = Math.max(0, (Date.now() - (state.lastTick || Date.now())) / 1000);
      if (elapsed > 1) advanceOffline(elapsed);
    } else {
      refreshMasterPool(); refreshMarket();
    }
  } catch (e) {
    if (state.availableMasters.length === 0) refreshMasterPool();
  }
  state.lastTick = Date.now();
}

export function resetState() {
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, makeFreshState());
  refreshMarket();
  refreshMasterPool();
  save();
}

/* ---------- PİYASA ---------- */
export function refreshMarket() {
  // Kâr marjı (istiridye referansı): 10–400 ₺/flaş, ortaya yakın dağılım
  const profitNorm = (Math.random() + Math.random()) / 2;
  const profitPerFlush = 10 + profitNorm * 390;

  // Malzeme katsayısı: 0.8–1.2
  const materialMult = 0.8 + Math.random() * 0.4;

  // İstiridye referans fiyatı (kâr garantili):
  // profitPerFlush = BATCH_YIELD_AVG × fiyat − (BASE_RECIPE_COST × materialMult) / flaşSayısı
  const flushCount = MUSHROOM_TYPES.oyster.flushYield.length;
  const costPerFlush = (BASE_RECIPE_COST * materialMult) / flushCount;
  const mushroomPrice = (profitPerFlush + costPerFlush) / BATCH_YIELD_AVG;

  // Türe özel talep: her tür için ±%15
  const demand = {};
  Object.keys(MUSHROOM_TYPES).forEach(k => {
    demand[k] = +(0.85 + Math.random() * 0.30).toFixed(2);
  });

  state.market = {
    profitPerFlush: Math.round(profitPerFlush),
    materialMult: +materialMult.toFixed(3),
    mushroomPrice: +mushroomPrice.toFixed(2),
    demand
  };
}

export function getMaterialPrice(key) {
  return Math.round(MATERIALS[key].price * (state.market?.materialMult || 1));
}

export function getMushroomBasePrice() {
  return state.market?.mushroomPrice || 165;
}

function containerPriceBonus() {
  return Math.max(0, ...state.containers.map(c => CONTAINER_LEVELS[c.level].priceBonus));
}

// Bir türün (konteyner bonusu hariç) kg fiyatı
export function getTypeBasePrice(type) {
  const t = MUSHROOM_TYPES[type] || MUSHROOM_TYPES.oyster;
  const demand = state.market?.demand?.[type] ?? 1;
  return getMushroomBasePrice() * t.priceMult * demand;
}

// Bir türün satış fiyatı (konteyner bonusu dahil)
export function getTypeSalePrice(type) {
  return getTypeBasePrice(type) * (1 + containerPriceBonus());
}

// Depodaki mantarların ağırlıklı ortalama kg fiyatı (depo boşsa istiridye referansı)
export function getMushroomSalePrice() {
  const total = totalStock();
  if (total <= 0) return getTypeSalePrice('oyster');
  let value = 0;
  Object.keys(state.stock).forEach(t => { value += state.stock[t] * getTypeSalePrice(t); });
  return value / total;
}

/* ---------- DEPO / STOK ---------- */
export function totalStock() {
  return Object.values(state.stock || {}).reduce((s, v) => s + v, 0);
}
function syncMushroomTotal() {
  state.inventory.mushroom = +totalStock().toFixed(4);
}
export function addMushroom(type, kg) {
  if (!MUSHROOM_TYPES[type]) type = 'oyster';
  state.stock[type] = (state.stock[type] || 0) + kg;
  syncMushroomTotal();
}
// Depodan "amount" kg satar (türlere orantılı dağıtır). Kazancı döndürür.
export function sellFromStock(amount) {
  const total = totalStock();
  const kg = Math.min(amount, total);
  if (kg <= 0) return 0;
  const f = kg / total;
  let revenue = 0;
  Object.keys(state.stock).forEach(t => {
    const sold = state.stock[t] * f;
    revenue += sold * getTypeSalePrice(t);
    state.stock[t] = f >= 1 ? 0 : state.stock[t] - sold;
  });
  syncMushroomTotal();
  state.money += revenue;
  return revenue;
}

/* ---------- KONTEYNER / HESAP ---------- */
export function containerById(id) {
  const c = state.containers.find(x => x.id === id);
  return CONTAINER_LEVELS[(c && c.level) || 1];
}
export function totalStorageCap() {
  return state.containers.reduce((s, c) => s + CONTAINER_LEVELS[c.level].storage, 0);
}
export function storageUsed() { return totalStock(); }
export function activeSubstrateIn(containerId) {
  return state.batches
    .filter(b => b.containerId === containerId && !['spent', 'contaminated'].includes(b.phase))
    .reduce((s) => s + BATCH_WEIGHT, 0);
}
export function totalActiveSubstrate() {
  return state.containers.reduce((s, c) => s + activeSubstrateIn(c.id), 0);
}
export function findContainerWithSpace() {
  return state.containers.find(c =>
    activeSubstrateIn(c.id) + BATCH_WEIGHT <= CONTAINER_LEVELS[c.level].capacity
  );
}

/* ---------- MALZEME / REÇETE ---------- */
export function getRecipeForType(type) {
  const t = MUSHROOM_TYPES[type] || MUSHROOM_TYPES.oyster;
  return { ...t.recipe };
}
export function hasMaterialsForType(type) {
  const recipe = getRecipeForType(type);
  return Object.entries(recipe).every(([mat, qty]) => (state.inventory[mat] || 0) >= qty - 1e-9);
}
export function consumeMaterialsForType(type) {
  const recipe = getRecipeForType(type);
  Object.entries(recipe).forEach(([mat, qty]) => {
    state.inventory[mat] = (state.inventory[mat] || 0) - qty;
  });
}

/* ---------- FORMAT ---------- */
export function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toString();
}
export function fmtMoney(n) { return '₺' + fmt(n); }

/* ---------- USTA YARDIMCILARI ---------- */
export function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function generateMaster(type) {
  const stars = 1 + Math.floor(Math.random() * 5);
  return {
    id: Date.now() + Math.random(),
    name: pickRandom(MALE_NAMES),
    surname: pickRandom(SURNAMES),
    stars, type,
    salary: STAR_SALARY[stars]
  };
}

export function refreshMasterPool() {
  state.availableMasters = [
    generateMaster('inoculate'),
    generateMaster('inoculate'),
    generateMaster('harvest'),
    generateMaster('harvest')
  ];
}

/* ---------- USTA HIZ ---------- */
export function getSpeedMultiplier(phase) {
  let mult = 1;
  if (phase === 'incubating') {
    const m = state.masters.find(x => x.type === 'inoculate');
    if (m) mult *= STAR_SPEED[m.stars];
  }
  if (phase === 'pinning' || phase === 'fruiting') {
    const m = state.masters.find(x => x.type === 'harvest');
    if (m) mult *= STAR_SPEED[m.stars];
  }
  return mult;
}

/* ---------- SÜRE (türe ve yönteme göre) ---------- */
export function computeDuration(b) {
  const t = MUSHROOM_TYPES[b.mushroomType] || MUSHROOM_TYPES.oyster;
  switch (b.phase) {
    case 'pasteurizing': {
      const m = METHODS[b.method] || METHODS.hot;
      return m.duration * t.prepMult;
    }
    case 'cooling':    return PHASES.cooling.duration * t.coolMult;
    case 'incubating': return t.incubation / getSpeedMultiplier('incubating');
    case 'pinning':    return t.pinning    / getSpeedMultiplier('pinning');
    case 'fruiting':   return t.fruiting   / getSpeedMultiplier('fruiting');
    case 'resting':    return t.rest;
    default:           return 0;
  }
}

/* ---------- KONTAMİNASYON RİSKİ ---------- */
export function contamRiskFor(typeKey, method, level) {
  const t = MUSHROOM_TYPES[typeKey] || MUSHROOM_TYPES.oyster;
  const m = METHODS[method] || METHODS.hot;
  const climate = CONTAINER_LEVELS[level || 1].climate;
  const methodFit = (t.methodMult && t.methodMult[method]) || 1;
  let risk = m.risk * methodFit * t.contamMult * (1.3 - climate);
  const master = state.masters.find(x => x.type === 'inoculate');
  if (master) risk *= 1 - (master.stars - 1) * 0.02;
  return Math.min(0.9, Math.max(0, +risk.toFixed(3)));
}

export function currentContamRisk(b) {
  const cont = state.containers.find(c => c.id === b.containerId);
  return contamRiskFor(b.mushroomType, b.method, cont ? cont.level : 1);
}

// Yeni parti ekranında gösterilen tahmini risk
export function estimateContamRisk(typeKey, method, containerId) {
  const cont = state.containers.find(c => c.id === containerId);
  return contamRiskFor(typeKey, method, cont ? cont.level : 1);
}

/* ---------- İKLİM → VERİM ---------- */
// Konteyner iklimi türün gereksiniminin altındaysa verim hızla düşer.
export function climateYieldMult(typeKey, climate) {
  const t = MUSHROOM_TYPES[typeKey] || MUSHROOM_TYPES.oyster;
  const base = 0.6 + climate * 0.6;
  const fit = climate >= t.climateMin ? 1 : Math.pow(climate / t.climateMin, 1.5);
  return base * fit;
}

/* ---------- OFFLINE ---------- */
export function advanceOffline(seconds) {
  state.batches.forEach(b => {
    let remaining = seconds;
    let guard = 0;
    while (remaining > 0 && !['cooled', 'ready', 'spent', 'contaminated'].includes(b.phase) && guard++ < 1000) {
      const dur = computeDuration(b);
      if (dur <= 0) break;
      const needed = (100 - b.progress) / 100 * dur;
      if (remaining >= needed) {
        remaining -= needed;
        b.progress = 100;
        nextPhaseInternal(b);
      } else {
        b.progress += (remaining / dur) * 100;
        remaining = 0;
      }
    }
  });
}

// game.js içindeki nextPhase ile aynı akış (log'suz)
function nextPhaseInternal(b) {
  switch (b.phase) {
    case 'pasteurizing': b.phase = 'cooling'; b.progress = 0; break;
    case 'cooling': b.phase = 'cooled'; b.progress = 100; break;
    case 'incubating':
      b.contamRisk = currentContamRisk(b);
      if (Math.random() < b.contamRisk) {
        b.phase = 'contaminated'; b.progress = 0;
        b.contamTick = state.tickCount;
        if (Array.isArray(b.logs)) b.logs.push('❌ Kontaminasyon! Parti kaybedildi.');
      } else { b.phase = 'pinning'; b.progress = 0; }
      break;
    case 'pinning': b.phase = 'fruiting'; b.progress = 0; break;
    case 'fruiting': b.phase = 'ready'; b.progress = 100; break;
    case 'resting': b.phase = 'pinning'; b.progress = 0; break;
  }
}
