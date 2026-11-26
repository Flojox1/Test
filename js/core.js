import {
  START_MONEY, BATCH_WEIGHT,
  MATERIALS, MUSHROOM_TYPES, BASE_RECIPE_COST, BATCH_YIELD_AVG,
  PHASES, METHODS, CONTAINER_LEVELS,
  STAR_SPEED, STAR_SALARY, MASTER_TYPES,
  MALE_NAMES, SURNAMES
} from './data.js';
import { START_PLOT, getProvince } from './plots.js';
import { firebaseConfig } from './config.js';
import { getFirebaseAuth } from './firebase.js';

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
    plots: [{ id: START_PLOT }],   // sahip olunan arsalar (id = il plaka kodu)
    containers: [{ id: 1, level: 1, plotId: START_PLOT }],
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
let activeSaveUid = null;
let remoteSaveTimer = null;
let remoteSaveQueue = Promise.resolve();

function isValidSave(parsed) {
  // Eski Firebase kayıtlarında batches alanı hiç bulunmayabilir.
  // Para alanı sayısalsa kayıt geçerlidir; eksik alanlar normalize edilir.
  return parsed && typeof parsed === "object" &&
    !Array.isArray(parsed) && typeof parsed.money === "number";
}

function applySave(parsed) {
  Object.keys(state).forEach(k => delete state[k]);
  Object.assign(state, parsed);

  // Firebase RTDB dizileri bazen sayısal anahtarlı nesne olarak döndürebilir.
  if (!Array.isArray(state.batches)) {
    state.batches = state.batches && typeof state.batches === "object"
      ? Object.keys(state.batches).sort((a, b) => Number(a) - Number(b)).map(k => state.batches[k])
      : [];
  }
  normalizeState();
}

function cloudSaveUrl(uid, token) {
  const base = firebaseConfig.databaseURL.replace(/\/$/, "");
  return `${base}/users/${encodeURIComponent(uid)}/gameSave.json?auth=${encodeURIComponent(token)}`;
}

async function writeCloudSave() {
  const uid = activeSaveUid;
  if (!uid) return;

  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  if (!user || user.uid !== uid) return;

  const token = await user.getIdToken(true);
  const response = await fetch(cloudSaveUrl(uid, token), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Bulut kayıt hatası (${response.status}): ${detail}`);
  }
}

export function save() {
  // Oyun kayıtları yalnızca Firebase hesabında tutulur.
  if (!activeSaveUid) return;

  state.lastTick = Date.now();
  if (remoteSaveTimer) clearTimeout(remoteSaveTimer);

  remoteSaveTimer = setTimeout(() => {
    remoteSaveQueue = remoteSaveQueue
      .then(() => writeCloudSave())
      .catch(error => console.error("Hesap kaydı buluta gönderilemedi:", error));
  }, 800);
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

  // Arsalar: eski kayıtlarda yoktu. Konteynerler Aksaray'a bağlanır.
  if (!Array.isArray(state.plots)) state.plots = [];
  state.plots = state.plots.filter(p => p && getProvince(p.id));
  state.containers.forEach(c => {
    if (!c.plotId || !getProvince(c.plotId)) c.plotId = START_PLOT;
    if (!state.plots.some(p => p.id === c.plotId)) state.plots.push({ id: c.plotId });
  });
  if (!state.plots.length) state.plots = [{ id: START_PLOT }];

  if (!Array.isArray(state.masters)) state.masters = [];
  // Eski kayıtlardaki konteyner ataması olmayan ustaları ilk konteynere bağla.
  state.masters.forEach(m => {
    if (!state.containers.some(c => Number(c.id) === Number(m.containerId))) {
      m.containerId = state.containers[0].id;
    }
  });
  if (!Array.isArray(state.availableMasters)) state.availableMasters = [];
  // Her konteyner için her uzmanlıkta yeterli kiralık aday bulunsun.
  const candidatesNeeded = Math.max(1, state.containers.length) * 2;
  for (const type of ['inoculate', 'harvest']) {
    let count = state.availableMasters.filter(m => m.type === type).length;
    while (count < candidatesNeeded) {
      state.availableMasters.push(generateMaster(type));
      count++;
    }
  }
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

export async function load(uid) {
  if (!uid) throw new Error("Hesap kimliği bulunamadı.");

  // Bulut kaydı başarıyla okunup doğrulanana kadar otomatik bulut yazımını kapalı tut.
  // Böylece başka cihazdaki boş başlangıç durumu mevcut kaydın üzerine yazamaz.
  activeSaveUid = null;

  const auth = await getFirebaseAuth();
  const user = auth.currentUser;
  if (!user || user.uid !== uid) {
    throw new Error("Oturum ile kayıt hesabı eşleşmiyor. Yeniden giriş yap.");
  }

  const token = await user.getIdToken(true);
  const response = await fetch(cloudSaveUrl(uid, token));

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Bulut kayıtları okunamadı (${response.status}): ${detail}`);
  }

  const cloudSave = await response.json();

  if (isValidSave(cloudSave)) {
    // Yalnızca doğrulanmış bulut kaydı yüklendikten sonra yazmaya izin ver.
    applySave(cloudSave);
    activeSaveUid = uid;
  } else if (cloudSave === null) {
    // İlk açılışta yeni kayıt oluştur; cihazlar arası local kayıt kullanılmaz.
    Object.keys(state).forEach(k => delete state[k]);
    Object.assign(state, makeFreshState());
    refreshMasterPool();
    refreshMarket();
    activeSaveUid = uid;
  } else {
    throw new Error("Firebase'deki oyun kaydı okunamadı. Kayıt korunuyor ve buluta yazım kapalı.");
  }

  const elapsed = Math.max(0, (Date.now() - (state.lastTick || Date.now())) / 1000);
  if (elapsed > 1) advanceOffline(elapsed);
  state.lastTick = Date.now();
  save();
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

/* ---------- ARSA ---------- */
export function ownsPlot(plate) {
  return state.plots.some(p => p.id === Number(plate));
}
export function plotContainers(plate) {
  return state.containers.filter(c => c.plotId === Number(plate));
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
  const choicesPerContainer = Math.max(1, state.containers.length) * 2;
  state.availableMasters = [
    ...Array.from({ length: choicesPerContainer }, () => generateMaster('inoculate')),
    ...Array.from({ length: choicesPerContainer }, () => generateMaster('harvest'))
  ];
}

/* ---------- USTA HIZ ---------- */
export function getSpeedMultiplier(phase, containerId) {
  let mult = 1;
  const assignedToContainer = m => containerId == null ||
    Number(m.containerId) === Number(containerId);
  if (phase === 'incubating') {
    const m = state.masters.find(x => x.type === 'inoculate' && assignedToContainer(x));
    if (m) mult *= STAR_SPEED[m.stars];
  }
  if (phase === 'pinning' || phase === 'fruiting') {
    const m = state.masters.find(x => x.type === 'harvest' && assignedToContainer(x));
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
    case 'incubating': return t.incubation / getSpeedMultiplier('incubating', b.containerId);
    case 'pinning':    return t.pinning    / getSpeedMultiplier('pinning', b.containerId);
    case 'fruiting':   return t.fruiting   / getSpeedMultiplier('fruiting', b.containerId);
    case 'resting':    return t.rest;
    default:           return 0;
  }
}

/* ---------- KONTAMİNASYON RİSKİ ---------- */
export function contamRiskFor(typeKey, method, level, containerId) {
  const t = MUSHROOM_TYPES[typeKey] || MUSHROOM_TYPES.oyster;
  const m = METHODS[method] || METHODS.hot;
  const climate = CONTAINER_LEVELS[level || 1].climate;
  const methodFit = (t.methodMult && t.methodMult[method]) || 1;
  let risk = m.risk * methodFit * t.contamMult * (1.3 - climate);
  const master = state.masters.find(x =>
    x.type === 'inoculate' &&
    (containerId == null || Number(x.containerId) === Number(containerId))
  );
  // Usta yıldız başına kontaminasyon riskini %12 azaltır.
  if (master) risk *= 1 - (master.stars - 1) * 0.12;
  // Gerçek olasılığı dört basamakta sakla; ekranda yuvarlayıp sahte %0 göstermeyelim.
  return Math.min(0.9, Math.max(0, +risk.toFixed(4)));
}

export function currentContamRisk(b) {
  const cont = state.containers.find(c => c.id === b.containerId);
  return contamRiskFor(b.mushroomType, b.method, cont ? cont.level : 1, b.containerId);
}

// Yeni parti ekranında gösterilen tahmini risk
export function estimateContamRisk(typeKey, method, containerId) {
  const cont = state.containers.find(c => c.id === containerId);
  return contamRiskFor(typeKey, method, cont ? cont.level : 1, containerId);
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
