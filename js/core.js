import {
  SAVE_KEY, START_MONEY, BATCH_WEIGHT,
  MATERIALS, RECIPE, BASE_RECIPE_COST, BATCH_YIELD_AVG,
  PHASES, METHODS, CONTAINER_LEVELS,
  STAR_SPEED, MASTER_TYPES,
  MALE_NAMES, SURNAMES
} from './data.js';

export const state = {
  money: START_MONEY,
  day: 1,
  tickCount: 0,
  speed: 1,
  inventory: { straw:0, bran:0, gypsum:0, lime:0, spawn:0, bag:0, mushroom:0 },
  batches: [],
  containers: [{ id: 1, level: 1 }],
  masters: [],
  availableMasters: [],
  masterRestart: 'stop',
  masterMethod: 'hot',
  lastMasterRefreshDay: 0,
  market: { profitPerFlush: 174, materialMult: 1, mushroomPrice: 165 },
  cart: {},
  lastTick: Date.now()
};

export function save() {
  try {
    state.lastTick = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch(e){}
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { refreshMasterPool(); refreshMarket(); return; }
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.money === 'number' && Array.isArray(parsed.batches)) {
      Object.keys(state).forEach(k => delete state[k]);
      Object.assign(state, parsed);
      if (!state.cart) state.cart = {};
      if (!Array.isArray(state.containers) || !state.containers.length) state.containers = [{ id: 1, level: 1 }];
      if (!Array.isArray(state.masters)) state.masters = [];
      if (!Array.isArray(state.availableMasters)) state.availableMasters = [];
      if (!state.masterRestart) state.masterRestart = 'stop';
      if (!state.masterMethod) state.masterMethod = 'hot';
      if (!state.speed) state.speed = 1;
      // migrate old market (number → object)
      if (typeof state.market === 'number') {
        refreshMarket();
        state.market.mushroomPrice = state.market.mushroomPrice || 165;
      }
      if (!state.market || typeof state.market !== 'object') refreshMarket();
      state.batches.forEach(b => {
        if (!b.containerId) b.containerId = 1;
        if (b.phase && PHASES[b.phase]) b.duration = PHASES[b.phase].duration;
      });
      if (state.availableMasters.length === 0) refreshMasterPool();
      const elapsed = Math.max(0, (Date.now() - (state.lastTick || Date.now())) / 1000);
      if (elapsed > 1) advanceOffline(elapsed);
    }
  } catch(e){ if (state.availableMasters.length === 0) refreshMasterPool(); }
  state.lastTick = Date.now();
}

export function resetState() {
  const fresh = {
    money: START_MONEY, day: 1, tickCount: 0, speed: 1,
    inventory: { straw:0, bran:0, gypsum:0, lime:0, spawn:0, bag:0, mushroom:0 },
    batches: [], containers: [{ id: 1, level: 1 }],
    masters: [], availableMasters: [],
    masterRestart: 'stop', masterMethod: 'hot',
    lastMasterRefreshDay: 0,
    market: { profitPerFlush: 174, materialMult: 1, mushroomPrice: 165 },
    cart: {}, lastTick: Date.now()
  };
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, fresh);
  refreshMarket();
  refreshMasterPool();
  save();
}

/* ---------- PİYASA ---------- */
export function refreshMarket() {
  // Kâr marjı: 10-400 ₺/flaş, ortaya yakın dağılım (iki rastgele ortalaması)
  const r1 = Math.random(), r2 = Math.random();
  const profitNorm = (r1 + r2) / 2;
  const profitPerFlush = 10 + profitNorm * 390;

  // Malzeme katsayısı: 0.8-1.2
  const materialMult = 0.8 + Math.random() * 0.4;

  // Türetilen mantar fiyatı (kâr garantili):
  // profitPerFlush = BATCH_YIELD_AVG × price − (BASE_RECIPE_COST × materialMult) / 3
  const costPerFlush = (BASE_RECIPE_COST * materialMult) / 3;
  const mushroomPrice = (profitPerFlush + costPerFlush) / BATCH_YIELD_AVG;

  state.market = {
    profitPerFlush: Math.round(profitPerFlush),
    materialMult: +materialMult.toFixed(3),
    mushroomPrice: +mushroomPrice.toFixed(2)
  };
}

export function getMaterialPrice(key) {
  return Math.round(MATERIALS[key].price * (state.market?.materialMult || 1));
}

export function getMushroomBasePrice() {
  return state.market?.mushroomPrice || 165;
}

export function getMushroomSalePrice() {
  const bonus = Math.max(...state.containers.map(c => CONTAINER_LEVELS[c.level].priceBonus));
  return getMushroomBasePrice() * (1 + bonus);
}

/* ---------- KONTEYNER / HESAP ---------- */
export function containerById(id) {
  const c = state.containers.find(x => x.id === id);
  return CONTAINER_LEVELS[(c && c.level) || 1];
}
export function totalStorageCap() {
  return state.containers.reduce((s, c) => s + CONTAINER_LEVELS[c.level].storage, 0);
}
export function storageUsed() { return state.inventory.mushroom; }
export function activeSubstrateIn(containerId) {
  return state.batches
    .filter(b => b.containerId === containerId && !['spent','contaminated'].includes(b.phase))
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

/* ---------- MALZEME ---------- */
export function hasMaterials() {
  const inv = state.inventory;
  return inv.straw >= RECIPE.straw && inv.bran >= RECIPE.bran &&
         inv.gypsum >= RECIPE.gypsum && inv.lime >= RECIPE.lime && inv.bag >= RECIPE.bag;
}
export function consumeMaterials() {
  state.inventory.straw  -= RECIPE.straw;
  state.inventory.bran   -= RECIPE.bran;
  state.inventory.gypsum -= RECIPE.gypsum;
  state.inventory.lime   -= RECIPE.lime;
  state.inventory.bag    -= RECIPE.bag;
}

/* ---------- FORMAT ---------- */
export function fmt(n) {
  if (n >= 1e6) return (n/1e6).toFixed(2)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
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
    salary: ({1:2,2:5,3:10,4:20,5:35})[stars]
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

export function computeDuration(b) {
  const base = (PHASES[b.phase] && PHASES[b.phase].duration) || 0;
  if (base === 0) return 0;
  if (b.phase === 'incubating') return base / getSpeedMultiplier('incubating');
  if (b.phase === 'pinning' || b.phase === 'fruiting') return base / getSpeedMultiplier('pinning');
  return base;
}

export function currentContamRisk(b) {
  const cont = state.containers.find(c => c.id === b.containerId);
  const level = cont ? cont.level : 1;
  const base = METHODS[b.method].risk;
  const climateFactor = 1.3 - CONTAINER_LEVELS[level].climate;
  let risk = base * climateFactor;
  const m = state.masters.find(x => x.type === 'inoculate');
  if (m) risk *= 1 - (m.stars - 1) * 0.02;
  return Math.max(0, +risk.toFixed(3));
}

/* ---------- OFFLINE ---------- */
export function advanceOffline(seconds) {
  state.batches.forEach(b => {
    let remaining = seconds;
    let guard = 0;
    while (remaining > 0 && !['cooled','ready','spent','contaminated'].includes(b.phase) && guard++ < 1000) {
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

// core içinden çağrılan basit nextPhase (game.js'deki sürümle aynı)
function nextPhaseInternal(b) {
  switch (b.phase) {
    case 'pasteurizing': b.phase = 'cooling'; b.progress = 0; break;
    case 'cooling': b.phase = 'cooled'; b.progress = 100; break;
    case 'incubating':
      b.contamRisk = currentContamRisk(b);
      if (Math.random() < b.contamRisk) { b.phase = 'contaminated'; b.progress = 0; }
      else { b.phase = 'pinning'; b.progress = 0; }
      break;
    case 'pinning': b.phase = 'fruiting'; b.progress = 0; break;
    case 'fruiting': b.phase = 'ready'; b.progress = 100; break;
    case 'resting': b.phase = 'pinning'; b.progress = 0; break;
  }
}
