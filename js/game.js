import {
  state, save, load, resetState,
  refreshMarket, refreshMasterPool,
  getMaterialPrice, getMushroomSalePrice,
  containerById, totalStorageCap, storageUsed,
  activeSubstrateIn, totalActiveSubstrate, findContainerWithSpace,
  hasMaterialsForType, consumeMaterialsForType, getRecipeForType,
  fmt, fmtMoney, generateMaster,
  computeDuration, currentContamRisk, getSpeedMultiplier,
  advanceOffline,
  addMushroom, sellFromStock, getTypeSalePrice, getTypeBasePrice,
  climateYieldMult, estimateContamRisk,
  ownsPlot, plotContainers
} from './core.js';

import {
  MATERIALS, RECIPE, MUSHROOM_TYPES, METHODS, PHASES, CONTAINER_LEVELS,
  NEW_CONTAINER_COST, BATCH_WEIGHT,
  MASTER_TYPES, STAR_SPEED, RESTART_MODES
} from './data.js';

import { PROVINCES, MAP_VIEWBOX } from './provinces.js';
import { getProvince, plotPrice } from './plots.js';

import { initChat } from './chat.js';

let activeTab = 'uretim';
let logicInterval = null;
let uretimView = 'list';
let viewingContainerId = null;
const expandedPlots = new Set();   // Üretim'de açık olan arsalar (plaka)
let selectedPlate = null;          // Arsalar sekmesinde seçili il

const tl = n => '₺' + Math.round(n).toLocaleString('tr-TR');
const riskPercent = risk => (Math.max(0, risk) * 100).toFixed(2);
function batchTimeLabel(b) {
  if (['cooled','ready','spent','contaminated'].includes(b.phase)) {
    return b.phase === 'ready' ? 'Hasada hazır' : (b.phase === 'cooled' ? 'Misel bekliyor' : '—');
  }
  const duration = computeDuration(b);
  const remaining = Math.max(0, Math.ceil(((100 - (b.progress || 0)) / 100) * duration / (state.speed || 1)));
  return `${remaining} sn kaldı`;
}

const tabContent = document.getElementById('tabContent');
const modalBack = document.getElementById('modalBack');
const modalEl = document.getElementById('modal');

/* ---------- ADVANCE STATE ---------- */
export function advanceState() {
  state.tickCount++;
  const prevDay = state.day;
  if (state.tickCount % 12 === 0) state.day++;

  if (state.day !== prevDay) {
    let salary = 0;
    state.masters.forEach(m => salary += m.salary);
    if (salary > 0) state.money -= salary;

    if (state.day % 60 === 0) {
      refreshMarket();
      state._marketChanged = true;
    }
    if (state.day % 7 === 0) {
      refreshMasterPool();
      state.lastMasterRefreshDay = state.day;
      state._masterPoolChanged = true;
    }
  }

  state.batches.forEach(b => {
    if (['cooled','ready','spent','contaminated'].includes(b.phase)) return;
    const dur = computeDuration(b);
    if (dur <= 0) return;
    b.duration = dur;
    b.progress += 100 / dur;
    if (b.progress >= 100) { b.progress = 100; nextPhase(b); }
  });

  processMasters();
}

/* ---------- PHASE ---------- */
export function nextPhase(b) {
  switch (b.phase) {
    case 'pasteurizing':
      b.phase = 'cooling'; b.progress = 0;
      b.logs.push('Pastörizasyon tamamlandı. Soğutuluyor.');
      break;
    case 'cooling':
      b.phase = 'cooled'; b.progress = 100;
      b.logs.push('Soğutuldu. Misel ekimi bekliyor (0.3 kg misel).');
      break;
    case 'incubating':
      b.contamRisk = currentContamRisk(b);
      if (Math.random() < b.contamRisk) {
        b.phase = 'contaminated'; b.progress = 0;
        b.contamTick = state.tickCount;
        b.logs.push('❌ Kontaminasyon! Parti kaybedildi.');
      } else {
        b.phase = 'pinning'; b.progress = 0;
        b.logs.push('Misel kolonize oldu. Pin oluşumu başlıyor.');
      }
      break;
    case 'pinning':
      b.phase = 'fruiting'; b.progress = 0;
      b.logs.push('Pinler oluştu. Meyveleme başladı.');
      break;
    case 'fruiting':
      b.phase = 'ready'; b.progress = 100;
      b.logs.push('🍄 Hasada hazır!');
      break;
    case 'resting':
      b.phase = 'pinning'; b.progress = 0;
      b.logs.push('Dinlenme bitti. Yeni flaş pin oluşumu.');
      break;
  }
}

/* ---------- PARTİ ---------- */
export function createBatch(method, containerId, mushroomType) {
  if (!hasMaterialsForType(mushroomType)) { alert('Seçilen mantar için malzeme eksik.'); return; }
  
  let cont = containerId != null ? state.containers.find(c => c.id === containerId) : findContainerWithSpace();
  if (!cont) { alert('Tüm konteynerler dolu.'); return; }
  if (activeSubstrateIn(cont.id) + BATCH_WEIGHT > CONTAINER_LEVELS[cont.level].capacity) {
    alert('Bu konteynerde boş slot yok.'); return;
  }

  const m = METHODS[method];
  if (state.money < m.cost) { alert('Ek maliyet için para yetersiz.'); return; }

  consumeMaterialsForType(mushroomType);
  state.money -= m.cost;

  const typeData = MUSHROOM_TYPES[mushroomType];
  const b = {
    id: Date.now() + Math.random(),
    containerId: cont.id,
    mushroomType: mushroomType,
    phase: 'pasteurizing',
    progress: 0,
    duration: m.duration,
    method,
    contamRisk: 0,
    flush: 1,
    logs: [`${typeData.name} kompostu karıştırıldı. ${m.name} başladı. Konteyner #${cont.id}.`]
  };
  b.contamRisk = currentContamRisk(b);
  state.batches.push(b);
  closeModal();
  render();
  save();
}

export function inoculate(id, silent) {
  const b = state.batches.find(x => x.id === id);
  if (!b || b.phase !== 'cooled') return false;
  if (state.inventory.spawn < 0.3 - 1e-9) {
    if (!silent) alert('0.3 kg misel gerekli.');
    else b.logs.push('⚠️ Misel yok, usta ekemedi.');
    return false;
  }
  state.inventory.spawn -= 0.3;
  b.phase = 'incubating';
  b.progress = 0;
  b.logs.push(silent ? '💉 Aşılama ustası misel ekledi.' : 'Misel ekildi. Kuluçka başladı.');
  return true;
}

export function harvest(id, silent) {
  const b = state.batches.find(x => x.id === id);
  if (!b || b.phase !== 'ready') return false;

  const typeData = MUSHROOM_TYPES[b.mushroomType];
  // Her türün kendi flaş sayısı ve flaş başına verimi var (kg / parti)
  const flushCount = typeData.flushYield.length;
  const base = typeData.flushYield[b.flush - 1] || 0;

  // İklim: konteyner türün gereksiniminin altındaysa verim düşer
  const cont = state.containers.find(c => c.id === b.containerId);
  const contLevel = CONTAINER_LEVELS[cont ? cont.level : 1];
  const climateMult = climateYieldMult(b.mushroomType, contLevel.climate);
  const harvMaster = state.masters.find(m =>
    m.type === 'harvest' && Number(m.containerId) === Number(b.containerId)
  );
  const yieldBonus = harvMaster ? 1 + (harvMaster.stars - 1) * 0.03 : 1;
  const yieldKg = +(base * climateMult * yieldBonus).toFixed(2);

  if (storageUsed() + yieldKg > totalStorageCap()) {
    if (!silent) alert('Depo dolu! Önce mantar sat.');
    else b.logs.push('⚠️ Depo dolu, usta hasat edemedi.');
    return false;
  }

  addMushroom(b.mushroomType, yieldKg);
  b.flush += 1;
  b.logs.push(silent
    ? `🍄 Usta hasat etti: ${yieldKg} kg (Flaş ${b.flush - 1}).`
    : `Hasat: ${yieldKg} kg mantar (Flaş ${b.flush - 1}).`);

  if (b.flush > flushCount) {
    b.phase = 'spent'; b.progress = 0;
    b.logs.push(`${flushCount} flaş tamamlandı. Parti tükendi.`);
    handleBatchRestart(b);
  } else {
    b.phase = 'resting'; b.progress = 0;
    b.logs.push('Parti dinlenmeye alındı.');
  }
  return true;
}

function handleBatchRestart(b) {
  if (!state.masters.some(m => Number(m.containerId) === Number(b.containerId))) return;
  const mode = state.masterRestart || 'stop';
  if (mode === 'stop') { b.logs.push('Durdur modu: yeni parti yok.'); return; }
  
  if (mode === 'autobuy') {
    tryBuyForType(b.mushroomType, b.containerId);
  }

  if (!hasMaterialsForType(b.mushroomType)) { b.logs.push('Malzeme yok, yeni parti başlatılamadı.'); return; }
  
  consumeMaterialsForType(b.mushroomType);
  const method = state.masterMethod || 'hot';
  b.phase = 'pasteurizing';
  b.method = method;
  b.progress = 0;
  b.flush = 1;
  b.logs.push('🔄 Yeni parti başlatıldı: ' + METHODS[method].name + '.');
}

function tryBuyForType(type, containerId) {
  const recipe = getRecipeForType(type);
  const need = {};
  let missing = false;
  for (const [mat, qty] of Object.entries(recipe)) {
    const have = state.inventory[mat] || 0;
    if (have < qty) { need[mat] = qty - have; missing = true; }
  }
  if (state.masters.some(m => m.type === 'inoculate' && Number(m.containerId) === Number(containerId))) {
    const needSpawn = Math.max(0, 0.3 - (state.inventory.spawn || 0));
    if (needSpawn > 0) { need.spawn = needSpawn; missing = true; }
  }
  if (!missing) return;
  let cost = 0;
  for (const [mat, qty] of Object.entries(need)) cost += getMaterialPrice(mat) * qty;
  if (state.money < cost) return;
  state.money -= cost;
  for (const [mat, qty] of Object.entries(need)) {
    state.inventory[mat] = (state.inventory[mat] || 0) + qty;
  }
}

export function manualRestart(id) {
  const b = state.batches.find(x => x.id === id);
  if (!b || b.phase !== 'spent') return;
  if (!hasMaterialsForType(b.mushroomType)) { alert('Malzeme yok. Pazar’dan al.'); return; }
  consumeMaterialsForType(b.mushroomType);
  const method = state.masterMethod || 'hot';
  b.phase = 'pasteurizing';
  b.method = method;
  b.progress = 0;
  b.flush = 1;
  b.logs.push('Manuel yeniden başlatıldı: ' + METHODS[method].name);
  render(); save();
}

export function removeBatch(id) {
  const idx = state.batches.findIndex(x => x.id === id);
  if (idx === -1) return;
  const b = state.batches[idx];
  if (!['spent','contaminated'].includes(b.phase)) {
    if (!confirm('Bu parti henüz bitmedi. Kaldırmak istediğine emin misin?')) return;
  }
  state.batches.splice(idx, 1);
  render(); save();
}

/* ---------- USTALAR ---------- */
export function hireMaster(id, containerId) {
  const idx = state.availableMasters.findIndex(m => m.id === id);
  if (idx === -1) return;
  const master = state.availableMasters[idx];
  const target = state.containers.find(c => Number(c.id) === Number(containerId));
  if (!target) { alert('Önce bir konteyner seç.'); return; }
  if (state.masters.some(m => m.type === master.type && Number(m.containerId) === Number(target.id))) {
    alert(`Konteyner #${target.id} için zaten bir ${MASTER_TYPES[master.type].name} var.`);
    return;
  }
  state.masters.push({ ...master, containerId: target.id });
  state.availableMasters.splice(idx, 1);
  render(); save();
}

export function fireMaster(id) {
  const idx = state.masters.findIndex(m => m.id === id);
  if (idx === -1) return;
  const master = state.masters[idx];
  if (!confirm(`${master.name} ${master.surname}'i kovmak istediğine emin misin?`)) return;
  state.masters.splice(idx, 1);
  render(); save();
}

export function processMasters() {
  state.batches.forEach(b => {
    const inoc = state.masters.find(m => m.type === 'inoculate' && Number(m.containerId) === Number(b.containerId));
    const harv = state.masters.find(m => m.type === 'harvest' && Number(m.containerId) === Number(b.containerId));
    if (b.phase === 'cooled' && inoc) {
      if (state.inventory.spawn < 0.3 - 1e-9) {
        const need = 0.3 - state.inventory.spawn;
        const cost = getMaterialPrice('spawn') * need;
        if (state.money >= cost) {
          state.money -= cost;
          state.inventory.spawn += need;
          b.logs.push(`💉 Usta ${need.toFixed(2)} kg misel satın aldı (-₺${Math.round(cost)}).`);
        } else {
          b.logs.push('⚠️ Usta misel alamadı: para yetersiz.');
        }
      }
      inoculate(b.id, true);
    }
    if (b.phase === 'ready' && harv) harvest(b.id, true);
  });

  for (let i = state.batches.length - 1; i >= 0; i--) {
    const b = state.batches[i];
    const hasStaffHere = state.masters.some(m => Number(m.containerId) === Number(b.containerId));
    if (hasStaffHere && b.phase === 'contaminated' && typeof b.contamTick === 'number'
        && (state.tickCount - b.contamTick) >= 6) {
      state.batches.splice(i, 1);
    }
  }
}

/* ---------- PAZAR ---------- */
export function addToCart(mat, qty) {
  if (!state.cart) state.cart = {};
  const wholeOnly = MATERIALS[mat]?.unit === 'adet';
  const safeQty = wholeOnly ? Math.floor(Number(qty)) : Math.round(Number(qty) * 100) / 100;
  if (!Number.isFinite(safeQty) || safeQty <= 0) return;
  state.cart[mat] = Math.round(((state.cart[mat] || 0) + safeQty) * 100) / 100;
  save(); renderPazar();
}
export function cartTotal() {
  let t = 0;
  for (const k in state.cart) t += getMaterialPrice(k) * state.cart[k];
  return t;
}
export function buyCart() {
  const keys = Object.keys(state.cart).filter(k => state.cart[k] > 0);
  if (!keys.length) return;
  const total = cartTotal();
  if (state.money < total) { alert('Para yetersiz. Toplam: ' + fmtMoney(total)); return; }
  state.money -= total;
  keys.forEach(k => state.inventory[k] += state.cart[k]);
  state.cart = {};
  save(); render();
}
export function sellMushrooms(qty) {
  const total = storageUsed();
  const amount = qty === 'all' ? total : Math.min(qty, total);
  if (amount <= 0) return;
  sellFromStock(amount);   // türlere orantılı satar, her türün kendi fiyatıyla
  render(); save();
}

/* ---------- KONTEYNER ---------- */
export function doUpgrade(containerId) {
  const cont = state.containers.find(c => c.id === containerId);
  if (!cont) return;
  const next = cont.level + 1;
  if (next >= CONTAINER_LEVELS.length) return;
  const lvl = CONTAINER_LEVELS[next];
  if (state.money < lvl.cost) { alert('Para yetersiz.'); return; }
  state.money -= lvl.cost;
  cont.level = next;
  render(); save();
}

export function buyNewContainer(plotId) {
  const prov = getProvince(plotId);
  if (!prov || !ownsPlot(plotId)) return;
  if (plotContainers(plotId).length >= prov.districts) {
    alert(`${prov.name} arsasında en fazla ${prov.districts} konteyner açılabilir.`);
    return;
  }
  if (state.money < NEW_CONTAINER_COST) { alert('Para yetersiz.'); return; }
  if (!confirm(`${prov.name} arsasına yeni konteyner için ${fmtMoney(NEW_CONTAINER_COST)} ödenecek.`)) return;
  state.money -= NEW_CONTAINER_COST;
  const newId = Math.max(...state.containers.map(c => c.id), 0) + 1;
  state.containers.push({ id: newId, level: 1, plotId: prov.plate });
  state.availableMasters.push(
    generateMaster('inoculate'), generateMaster('inoculate'),
    generateMaster('harvest'), generateMaster('harvest')
  );
  expandedPlots.add(prov.plate);
  render(); save();
}

/* ---------- ARSA ---------- */
export function buyPlot(plate) {
  const prov = getProvince(plate);
  if (!prov || ownsPlot(plate)) return;
  const price = plotPrice(prov);
  if (state.money < price) { alert('Para yetersiz. ' + prov.name + ' arsası: ' + tl(price)); return; }
  if (!confirm(`${prov.name} arsası için ${tl(price)} ödenecek.`)) return;
  state.money -= price;
  state.plots.push({ id: prov.plate });
  render(); save();
}

function goToProduction(plate) {
  expandedPlots.add(Number(plate));
  uretimView = 'list';
  viewingContainerId = null;
  activeTab = 'uretim';
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'uretim'));
  render();
}

/* ---------- RENDER ---------- */
export function renderHUD() {
  const moneyEl = document.getElementById('statMoney');
  moneyEl.textContent = fmtMoney(state.money);
  moneyEl.classList.toggle('danger', state.money < 0);
  moneyEl.classList.toggle('gold', state.money >= 0);
  document.getElementById('statDay').textContent = state.day;
  document.getElementById('statPrice').textContent = '₺' + Math.round(getMushroomSalePrice()) + '/kg';
  document.getElementById('statPlot').textContent = state.plots.length;
  document.getElementById('statContainer').textContent = state.containers.length;
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.speed) === state.speed);
  });
}

export function render() {
  renderHUD();
  if (activeTab === 'uretim') renderUretim();
  else if (activeTab === 'arsalar') renderArsalar();
  else if (activeTab === 'pazar') renderPazar();
  else if (activeTab === 'ustalar') renderUstalar();
  else if (activeTab === 'depo') renderDepo();
}

// Not: Arsalar sekmesi canlı yenilenmez (harita her saniye yeniden çizilmesin diye).
export function renderLive() {
  renderHUD();
  if (activeTab === 'uretim') {
    if (uretimView === 'container' && viewingContainerId != null) {
      updateLiveContainerView(); 
    } else {
      renderUretim();
    }
  }
  else if (activeTab === 'depo') renderDepo();
  else if (activeTab === 'pazar' && state._marketChanged) {
    renderPazar(); state._marketChanged = false;
  } else if (activeTab === 'ustalar' && state._masterPoolChanged) {
    renderUstalar(); state._masterPoolChanged = false;
  }
}

function updateLiveContainerView() {
  const cont = state.containers.find(c => c.id === viewingContainerId);
  if (!cont) return;
  const activeBatches = state.batches.filter(b => b.containerId === cont.id && !['spent','contaminated'].includes(b.phase));
  activeBatches.forEach(b => {
    const slotEl = document.querySelector(`.slot[data-id="${b.id}"]`);
    if (!slotEl) return;
    const fill = slotEl.querySelector('.slot-fill');
    if (fill) fill.style.width = `${b.progress}%`;
    const phaseText = slotEl.querySelector('.slot-phase');
    if (phaseText && PHASES[b.phase]) {
      const typeName = MUSHROOM_TYPES[b.mushroomType]?.name || '?';
      phaseText.innerHTML = `${typeName}<br>${PHASES[b.phase].label}`;
    }
    const timeEl = slotEl.querySelector('.slot-time');
    if (timeEl) timeEl.textContent = batchTimeLabel(b);
    const iconEl = slotEl.querySelector('.slot-icon');
    if (iconEl) {
      const newIcon = getPhaseIcon(b);
      if (iconEl.textContent !== newIcon) iconEl.textContent = newIcon;
    }
  });
}

/* ---------- ÜRETİM ---------- */
export function renderUretim() {
  if (uretimView === 'container' && viewingContainerId != null) {
    const cont = state.containers.find(c => c.id === viewingContainerId);
    if (!cont) { uretimView = 'list'; viewingContainerId = null; return renderUretim(); }
    renderContainerView(cont);
  } else {
    renderContainerList();
  }
}

function renderContainerList() {
  let html = `
    <div class="section-head">
      <h2>Üretim · Konteynerler</h2>
      <button class="btn btn-ghost" data-action="skipDay">⏩ 1 Gün</button>
    </div>
  `;

  const totCap = state.containers.reduce((s, c) => s + CONTAINER_LEVELS[c.level].capacity, 0);
  html += `<div class="hint">Toplam substrat: <b>${totalActiveSubstrate()} / ${totCap} kg</b> · Depo: <b>${storageUsed().toFixed(1)} / ${totalStorageCap()} kg</b> · Bir arsanın adına dokununca içindeki konteynerler açılır.</div>`;

  html += `<div class="plot-list">`;
  state.plots.forEach(pl => {
    const prov = getProvince(pl.id);
    if (!prov) return;
    const conts = plotContainers(pl.id);
    const open = expandedPlots.has(pl.id);
    html += `
      <div class="plot-group ${open ? 'open' : ''}">
        <div class="plot-head" data-action="togglePlot" data-plot="${pl.id}">
          <span class="plate">${String(prov.plate).padStart(2, '0')}</span>
          <div class="pinfo">
            <h3>${prov.name}</h3>
            <div class="psub">${conts.length}/${prov.districts} konteyner</div>
          </div>
          <span class="chev">${open ? '▾' : '▸'}</span>
        </div>
    `;
    if (open) {
      html += `<div class="plot-body container-list">`;
      conts.forEach(c => {
        const lvl = CONTAINER_LEVELS[c.level];
        const active = activeSubstrateIn(c.id);
        const pct = Math.min(100, (active / lvl.capacity) * 100);
        const slotCount = Math.floor(lvl.capacity / BATCH_WEIGHT);
        const usedSlots = Math.floor(active / BATCH_WEIGHT);
        html += `
          <div class="container-list-item" data-action="openContainer" data-id="${c.id}">
            <div class="head">
              <h3>Konteyner #${c.id}</h3>
              <span class="sv">Sv.${c.level}</span>
            </div>
            <div class="name">${lvl.name}</div>
            <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
            <div class="bar-info">
              <span>${active}/${lvl.capacity} kg</span>
              <span>${usedSlots}/${slotCount} slot</span>
            </div>
          </div>
        `;
      });
      if (conts.length < prov.districts) {
        html += `
          <div class="container-list-item add" data-action="buyContainer" data-plot="${pl.id}">
            <h3>+ Yeni Konteyner</h3>
            <div class="price">${fmtMoney(NEW_CONTAINER_COST)}</div>
          </div>
        `;
      } else {
        html += `<div class="hint">${prov.name} arsası dolu (${prov.districts} ilçe = ${prov.districts} konteyner).</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  });
  html += `</div>`;
  tabContent.innerHTML = html;
}

function renderContainerView(cont) {
  const lvl = CONTAINER_LEVELS[cont.level];
  const next = CONTAINER_LEVELS[cont.level + 1];
  const active = activeSubstrateIn(cont.id);
  const slotCount = Math.floor(lvl.capacity / BATCH_WEIGHT);
  const batchesHere = state.batches.filter(b => b.containerId === cont.id);
  const activeBatches = batchesHere.filter(b => !['spent','contaminated'].includes(b.phase));
  const deadBatches = batchesHere.filter(b => ['spent','contaminated'].includes(b.phase));

  let html = `
    <div class="container-view-head">
      <div class="left">
        <button class="x-btn" data-action="exitContainer" aria-label="Geri">×</button>
        <div class="title-block">
          <h3>Konteyner #${cont.id}</h3>
          <div class="name">${getProvince(cont.plotId)?.name || ''} · ${lvl.name} · Sv.${cont.level}</div>
        </div>
      </div>
      ${next ? `<button class="btn btn-green" data-action="openUpgrade" data-id="${cont.id}">Yükselt</button>` : ''}
    </div>
    
    <div class="container-detail">
      <div class="hint">
        Substrat: <b>${active}/${lvl.capacity} kg</b> ·
        Slot: <b>${activeBatches.length}/${slotCount}</b> ·
        İklim: <b>%${Math.round(lvl.climate*100)}</b>
      </div>

      <div class="slot-grid" id="slotGrid">
  `;

  for (let i = 0; i < slotCount; i++) {
    if (i < activeBatches.length) {
      const b = activeBatches[i];
      const ph = PHASES[b.phase] || { label: '?' };
      const isReady = b.phase === 'ready';
      const isBad = b.phase === 'contaminated';
      const icon = getPhaseIcon(b);
      const typeName = MUSHROOM_TYPES[b.mushroomType]?.name || '?';
      
      html += `
        <div class="slot filled ${isReady?'ready':''} ${isBad?'bad':''}" data-action="openBatch" data-id="${b.id}">
          <div class="slot-icon">${icon}</div>
          <div class="slot-phase">${typeName}<br>${ph.label}</div>
          <div class="slot-time">${batchTimeLabel(b)}</div>
          <div class="slot-bar"><div class="slot-fill" style="width:${b.progress||0}%"></div></div>
        </div>
      `;
    } else {
      html += `<div class="slot empty" data-action="newBatchIn" data-container="${cont.id}" aria-label="Yeni Parti">+</div>`;
    }
  }
  
  html += `</div></div>`;

  if (deadBatches.length > 0) {
    html += `<div class="dead-batches"><div class="dead-title">Temizlenmesi Gerekenler</div>`;
    deadBatches.forEach(b => {
      const isBad = b.phase === 'contaminated';
      html += `
        <div class="dead-batch">
          <span>${MUSHROOM_TYPES[b.mushroomType]?.icon || ''} ${MUSHROOM_TYPES[b.mushroomType]?.name || ''} · ${isBad?'❌ Kontamine':'✅ Tükendi'} · Flaş ${b.flush-1}/${MUSHROOM_TYPES[b.mushroomType]?.flushYield.length || 3}</span>
          <button class="btn btn-danger" data-action="remove" data-id="${b.id}">Kaldır</button>
        </div>
      `;
    });
    html += `</div>`;
  }
  tabContent.innerHTML = html;
}

/* ---------- ARSALAR (TÜRKİYE HARİTASI) ---------- */
const MAP_DIM = MAP_VIEWBOX.split(' ').map(Number);
const MAP_W = MAP_DIM[2];
const MAP_H = MAP_DIM[3];
const mapView = { x: 0, y: 0, w: MAP_W };   // yakınlaştırma / kaydırma durumu
let mapDragged = false;                      // sürükleme sonrası yanlışlıkla il seçilmesin

function mapViewBox() {
  const h = mapView.w * MAP_H / MAP_W;
  return `${mapView.x.toFixed(1)} ${mapView.y.toFixed(1)} ${mapView.w.toFixed(1)} ${h.toFixed(1)}`;
}
function clampMapView() {
  mapView.w = Math.min(MAP_W, Math.max(MAP_W / 10, mapView.w));
  const h = mapView.w * MAP_H / MAP_W;
  mapView.x = Math.min(MAP_W - mapView.w, Math.max(0, mapView.x));
  mapView.y = Math.min(MAP_H - h, Math.max(0, mapView.y));
}
// fx, fy: yakınlaştırma noktasının harita üzerindeki oranı (0..1)
function zoomMap(svg, factor, fx = 0.5, fy = 0.5) {
  const h = mapView.w * MAP_H / MAP_W;
  const px = mapView.x + mapView.w * fx;
  const py = mapView.y + h * fy;
  mapView.w = mapView.w / factor;
  clampMapView();
  const nh = mapView.w * MAP_H / MAP_W;
  mapView.x = px - mapView.w * fx;
  mapView.y = py - nh * fy;
  clampMapView();
  svg.setAttribute('viewBox', mapViewBox());
}

function setupMapInteractions(svg) {
  const pointers = new Map();
  let startDist = 0;

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    zoomMap(svg, e.deltaY < 0 ? 1.25 : 0.8, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  }, { passive: false });

  svg.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    mapDragged = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      startDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });

  svg.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const r = svg.getBoundingClientRect();
    if (pointers.size === 1) {
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) mapDragged = true;
      if (mapDragged) {
        const k = mapView.w / r.width;
        mapView.x -= (e.clientX - p.x) * k;
        mapView.y -= (e.clientY - p.y) * k;
        clampMapView();
        svg.setAttribute('viewBox', mapViewBox());
      }
      p.x = e.clientX; p.y = e.clientY;
    } else if (pointers.size === 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (startDist > 0 && d > 0) {
        mapDragged = true;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        zoomMap(svg, d / startDist, (mx - r.left) / r.width, (my - r.top) / r.height);
        startDist = d;
      }
    }
  });

  const end = e => { pointers.delete(e.pointerId); startDist = 0; };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('pointerleave', end);
}

function plotPanelHtml(p) {
  const owned = ownsPlot(p.plate);
  const price = plotPrice(p);
  const have = plotContainers(p.plate).length;
  const canBuy = state.money >= price;
  return `
    <aside class="plot-panel" id="plotPanel">
      <div class="pp-head">
        <span class="plate">${String(p.plate).padStart(2, '0')}</span>
        <h3>${p.name}</h3>
        <button class="x-btn" data-action="closePanel" aria-label="Kapat">×</button>
      </div>
      <div class="pp-badge ${owned ? 'owned' : ''}">${owned ? '✔ Bu arsa senin' : 'Satılık arsa'}</div>
      <div class="pp-rows">
        <div class="row"><span class="k">Arsa fiyatı</span><span class="v gold">${owned ? 'Satın alındı' : tl(price)}</span></div>
        <div class="row"><span class="k">Açılabilecek konteyner</span><span class="v green">${p.districts}</span></div>
        <div class="row"><span class="k">İlçe sayısı</span><span class="v">${p.districts}</span></div>
        <div class="row"><span class="k">Nüfus (yaklaşık)</span><span class="v">${(p.pop * 1000).toLocaleString('tr-TR')}</span></div>
        <div class="row"><span class="k">Konteyner maliyeti</span><span class="v">${tl(NEW_CONTAINER_COST)} / adet</span></div>
        ${owned ? `<div class="row"><span class="k">Açılan konteyner</span><span class="v green">${have}/${p.districts}</span></div>` : ''}
      </div>
      ${owned
        ? `<button class="btn btn-green pp-btn" data-action="goPlot" data-plate="${p.plate}">Üretime Git</button>`
        : `<button class="btn btn-green pp-btn" data-action="buyPlot" data-plate="${p.plate}" ${canBuy ? '' : 'disabled'}>${canBuy ? 'Satın Al · ' : 'Para Yetersiz · '}${tl(price)}</button>`}
    </aside>
  `;
}

export function renderArsalar() {
  const sel = selectedPlate != null ? getProvince(selectedPlate) : null;
  const paths = [];
  let selPath = '';   // seçili il en üstte çizilsin (kenar çizgisi komşular altında kalmasın)
  PROVINCES.forEach(p => {
    const owned = ownsPlot(p.plate);
    const isSel = !!sel && sel.plate === p.plate;
    const label = `${p.name} · ${owned ? 'Senin' : tl(plotPrice(p))} · ${p.districts} konteyner`;
    const el = `<path class="prov${owned ? ' owned' : ''}${isSel ? ' sel' : ''}" data-action="selectProvince" data-plate="${p.plate}" d="${p.path}"><title>${label}</title></path>`;
    if (isSel) selPath = el; else paths.push(el);
  });

  const options = [...PROVINCES]
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    .map(p => `<option value="${p.plate}"${sel && sel.plate === p.plate ? ' selected' : ''}>${p.name}</option>`)
    .join('');

  tabContent.innerHTML = `
    <div class="section-head"><h2>Arsalar · Türkiye</h2></div>
    <div class="hint">Bir ile dokun: arsa fiyatını ve kaç konteyner açabileceğini gör. Bir arsada <b>ilçe sayısı kadar</b> konteyner açılır. Başlangıç arsan <b>Aksaray</b>.</div>
    <div class="arsa-wrap ${sel ? 'has-sel' : ''}">
      <div class="map-box">
        <div class="map-tools">
          <select class="setting-select" id="provSelect"><option value="">İl seç…</option>${options}</select>
          <div class="zoom">
            <button class="btn btn-ghost" data-action="mapZoomIn" aria-label="Yakınlaştır">+</button>
            <button class="btn btn-ghost" data-action="mapZoomOut" aria-label="Uzaklaştır">−</button>
            <button class="btn btn-ghost" data-action="mapReset" aria-label="Haritayı sıfırla">⟲</button>
          </div>
        </div>
        <svg id="trMap" class="tr-map" viewBox="${mapViewBox()}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Türkiye haritası">${paths.join('')}${selPath}</svg>
        <div class="map-legend">
          <span><i class="dot owned"></i>Senin</span>
          <span><i class="dot"></i>Satılık</span>
          <span><i class="dot sel"></i>Seçili</span>
        </div>
      </div>
      ${sel ? plotPanelHtml(sel) : ''}
    </div>
  `;

  setupMapInteractions(document.getElementById('trMap'));
  document.getElementById('provSelect').addEventListener('change', e => {
    if (!e.target.value) return;
    selectedPlate = parseInt(e.target.value);
    renderArsalar();
  });
}

/* ---------- PAZAR ---------- */
export function renderPazar() {
  let html = `<div class="section-head"><h2>Pazar</h2></div>`;
  const next = 60 - (state.day % 60);
  html += `<div class="hint">
    Piyasa: <b>Flaş başına ~₺${state.market.profitPerFlush}</b> kâr ·
    Malzeme <b>${state.market.materialMult.toFixed(2)}×</b> ·
    Sonraki: <b>${next} gün</b>
  </div>`;

  // Türe göre güncel mantar fiyatları
  html += `<div class="container-card"><h3>Mantar Fiyatları</h3><span class="lvl">Güncel talep</span>`;
  Object.entries(MUSHROOM_TYPES).forEach(([key, t]) => {
    const d = state.market.demand?.[key] ?? 1;
    const arrow = d >= 1.05 ? ' ▲' : (d <= 0.95 ? ' ▼' : '');
    html += `<div class="cart-row"><span>${t.icon} ${t.name}</span><span>₺${Math.round(getTypeSalePrice(key))}/kg${arrow}</span></div>`;
  });
  html += `</div>`;

  html += `<div class="mat-list">`;
  Object.entries(MATERIALS).forEach(([key, m]) => {
    const inCart = state.cart[key] || 0;
    const owned = (+state.inventory[key]).toFixed(key === 'bag' ? 0 : 1);
    const price = getMaterialPrice(key);
    html += `
      <div class="mat">
        <div class="mat-main">
          <div class="ico">${m.icon}</div>
          <div class="info">
            <div class="name">${m.name}</div>
            <div class="sub">₺${price}/${m.unit}${inCart ? ' · Sepette ' + inCart : ''}</div>
          </div>
          <div class="own">${owned} ${m.unit}</div>
        </div>
        <div class="mat-controls">
          <button class="btn btn-ghost" data-action="cartAdd" data-mat="${key}" data-qty="1">+1</button>
          <button class="btn btn-ghost" data-action="cartAdd" data-mat="${key}" data-qty="10">+10</button>
          <input type="text" class="qty-input" data-mat="${key}" placeholder="${m.unit === 'adet' ? 'Adet...' : 'Örn. 0,5'}" inputmode="${m.unit === 'adet' ? 'numeric' : 'decimal'}" autocomplete="off" aria-label="${m.name} miktarı" />
          <button class="btn btn-ghost" data-action="cartAddCustom" data-mat="${key}">Ekle</button>
        </div>
      </div>
    `;
  });
  html += `</div>`;

  const keys = Object.keys(state.cart).filter(k => state.cart[k] > 0);
  if (keys.length > 0) {
    let total = 0;
    let rows = '';
    keys.forEach(k => {
      const m = MATERIALS[k];
      const q = state.cart[k];
      const sub = getMaterialPrice(k) * q;
      total += sub;
      rows += `
        <div class="cart-row">
          <span>${m.icon} ${m.name} × ${Number(q).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${m.unit}</span>
          <span>₺${sub}</span>
          <button class="cart-rm" data-action="cartRemove" data-mat="${k}">×</button>
        </div>
      `;
    });
    html += `
      <div class="cart-box">
        <h3>Sepet</h3>
        ${rows}
        <div class="cart-total"><span>Toplam</span><span class="big">₺${total}</span></div>
        <div class="cart-btns">
          <button class="btn btn-ghost" data-action="cartClear">Temizle</button>
          <button class="btn btn-green" data-action="cartBuy">Satın Al</button>
        </div>
      </div>
    `;
  }

  const price = getMushroomSalePrice();
  html += `
    <div class="sell-box">
      <h3>Mantar Sat</h3>
      <div class="sell-row">
        <div>
          <div style="font-size:0.7rem;color:var(--muted)">Depoda: ${storageUsed().toFixed(1)} kg</div>
          <div class="big">₺${price.toFixed(0)}/kg</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-green" data-action="sell" data-qty="1">1 kg</button>
          <button class="btn btn-green" data-action="sell" data-qty="5">5 kg</button>
          <button class="btn btn-green" data-action="sell" data-qty="all">Tümünü Sat</button>
        </div>
      </div>
    </div>
  `;
  tabContent.innerHTML = html;
}

/* ---------- USTALAR ---------- */
export function renderUstalar() {
  let html = `<div class="section-head"><h2>Ustalar</h2></div>`;

  const totalSalary = state.masters.reduce((s, m) => s + m.salary, 0);
  if (totalSalary > 0) {
    html += `<div class="hint ${state.money < totalSalary ? 'danger' : ''}">
      Günlük maaş: <b>₺${totalSalary}</b>${state.money < totalSalary ? ' · ⚠️ Bakiye düşük!' : ''}
    </div>`;
  } else {
    html += `<div class="hint">Usta kiralamadın. Ustalar misel ekme ve hasat işlerini otomatikleştirir. Kontamine kompostları da temizler.</div>`;
  }
  
  html += `<div style="font-family:var(--font-head);font-size:0.82rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--green-bright);margin:14px 0 8px">Usta Davranışı</div>`;
  html += `
    <div class="setting-row">
      <label>Parti Bitince (Son Flaştan Sonra)</label>
      <select class="setting-select" id="settingRestart">
        <option value="stop">${RESTART_MODES.stop.name}</option>
        <option value="ifhave">${RESTART_MODES.ifhave.name}</option>
        <option value="autobuy">${RESTART_MODES.autobuy.name}</option>
      </select>
    </div>
    <div class="setting-row">
      <label>Kültivasyon Yöntemi</label>
      <select class="setting-select" id="settingMethod">
        <option value="hot">Sıcak Su</option>
        <option value="lime">Kireç Banyosu</option>
        <option value="steam">Buhar</option>
      </select>
    </div>
  `;

  html += `<div style="font-family:var(--font-head);font-size:0.82rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--green-bright);margin:14px 0 8px">Kiralanan (${state.masters.length})</div>`;
  if (state.masters.length === 0) {
    html += `<div style="font-size:0.72rem;color:var(--muted);padding:8px 0">Henüz usta yok.</div>`;
  } else {
    state.masters.forEach(m => {
      const t = MASTER_TYPES[m.type];
      const stars = '★'.repeat(m.stars) + '☆'.repeat(5 - m.stars);
      let effect = m.type === 'inoculate'
        ? `Konteyner #${m.containerId} · Kuluçka <b>${STAR_SPEED[m.stars].toFixed(2)}×</b> · Risk <b>-%${(m.stars-1)*12}</b>`
        : `Konteyner #${m.containerId} · Pin+Meyveleme <b>${STAR_SPEED[m.stars].toFixed(2)}×</b> · Verim <b>+%${(m.stars-1)*3}</b>`;
      html += `
        <div class="master-card hired">
          <div class="master-header">
            <div class="master-name">${m.name} ${m.surname}</div>
            <div class="master-stars">${stars}</div>
          </div>
          <div class="master-info">
            <span class="mtype">${t.icon} ${t.name}</span>
            <span class="msalary">₺${m.salary}/gün</span>
          </div>
          <div class="master-effect">${effect}</div>
          <div class="master-actions">
            <button class="btn btn-danger" data-action="fireMaster" data-id="${m.id}">Kov</button>
          </div>
        </div>
      `;
    });
  }

  const nextRefresh = state.lastMasterRefreshDay + 7 - state.day;
  html += `<div style="font-family:var(--font-head);font-size:0.82rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--green-bright);margin:18px 0 4px">Kiralık Ustalar</div>`;
  html += `<div style="font-size:0.66rem;color:var(--muted);margin-bottom:10px">Yenilenmeye <b>${Math.max(0, nextRefresh)} gün</b> (her 7 gün).</div>`;

  state.availableMasters.forEach(m => {
    const t = MASTER_TYPES[m.type];
    const stars = '★'.repeat(m.stars) + '☆'.repeat(5 - m.stars);
    const targets = state.containers.filter(c =>
      !state.masters.some(x => x.type === m.type && Number(x.containerId) === Number(c.id))
    );
    let effect = m.type === 'inoculate'
      ? `Kuluçka <b>${STAR_SPEED[m.stars].toFixed(2)}×</b> · Risk <b>-%${(m.stars-1)*12}</b>`
      : `Pin+Meyveleme <b>${STAR_SPEED[m.stars].toFixed(2)}×</b> · Verim <b>+%${(m.stars-1)*3}</b>`;
    const targetOptions = targets.map(c => `<option value="${c.id}">Konteyner #${c.id}</option>`).join('');
    html += `
      <div class="master-card">
        <div class="master-header">
          <div class="master-name">${m.name} ${m.surname}</div>
          <div class="master-stars">${stars}</div>
        </div>
        <div class="master-info">
          <span class="mtype">${t.icon} ${t.name}</span>
          <span class="msalary">₺${m.salary}/gün</span>
        </div>
        <div class="master-effect">${effect}</div>
        <div class="master-actions">
          <select class="setting-select" id="masterTarget-${m.id}" aria-label="Ustanın atanacağı konteyner" ${targets.length ? '' : 'disabled'}>
            ${targetOptions || '<option value="">Boş usta yeri yok</option>'}
          </select>
          <button class="btn btn-green" data-action="hireMaster" data-id="${m.id}" data-target-select="masterTarget-${m.id}" ${targets.length ? '' : 'disabled'}>Kirala</button>
        </div>
      </div>
    `;
  });

  tabContent.innerHTML = html;

  const rs = document.getElementById('settingRestart');
  const ms = document.getElementById('settingMethod');
  if (rs) {
    rs.value = state.masterRestart || 'stop';
    rs.addEventListener('change', e => { state.masterRestart = e.target.value; save(); });
  }
  if (ms) {
    ms.value = state.masterMethod || 'hot';
    ms.addEventListener('change', e => { state.masterMethod = e.target.value; save(); });
  }
}

/* ---------- DEPO ---------- */
export function renderDepo() {
  const cap = totalStorageCap();
  const used = storageUsed();
  const pct = Math.min(100, (used / cap) * 100);
  const price = getMushroomSalePrice();
  let html = `<div class="section-head"><h2>Depo</h2></div>`;
  html += `
    <div class="container-card">
      <h3>Mantar Deposu</h3>
      <span class="lvl">${used.toFixed(1)} / ${cap} kg</span>
      <div class="storage-bar"><div class="fill" style="width:${pct}%"></div></div>
      <div class="sell-row">
        <div class="big">₺${(used * price).toFixed(0)}</div>
        <button class="btn btn-green" data-action="sell" data-qty="all" ${used<=0?'disabled':''}>Tümünü Sat</button>
      </div>
    </div>
    <div class="hint">Depo kapasitesi tüm konteynerlerin toplamı. Mantar beklerken bozulmaz.</div>
  `;
  const stockRows = Object.entries(MUSHROOM_TYPES)
    .filter(([k]) => (state.stock[k] || 0) > 0.0001)
    .map(([k, t]) => `<div class="cart-row"><span>${t.icon} ${t.name} · ${state.stock[k].toFixed(1)} kg</span><span>₺${Math.round(getTypeSalePrice(k))}/kg</span></div>`)
    .join('');
  if (stockRows) html += `<div class="container-card"><h3>Türe Göre Stok</h3>${stockRows}</div>`;
  tabContent.innerHTML = html;
}

/* ---------- MODAL ---------- */
export function openNewBatchModal(containerId) {
  const cont = state.containers.find(c => c.id === containerId);
  if (!cont) return;
  if (activeSubstrateIn(cont.id) + BATCH_WEIGHT > CONTAINER_LEVELS[cont.level].capacity) {
    alert('Bu konteynerde boş slot yok.');
    return;
  }

  let html = `
    <h2>Yeni Parti</h2>
    <span class="sub">Konteyner #${cont.id}</span>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:6px;margin-bottom:12px">
  `;

  Object.entries(MUSHROOM_TYPES).forEach(([key, t], idx) => {
    html += `<button class="btn ${idx===0?'btn-green':'btn-ghost'} type-btn" data-type="${key}" style="font-size:0.6rem;padding:8px 4px;line-height:1.3">${t.icon}<br>${t.name}</button>`;
  });
  html += `</div><div id="recipeBox"></div>`;

  html += `<button class="close" id="modalClose">Kapat</button>`;
  modalEl.innerHTML = html;
  modalBack.classList.add('on');
  modalEl.querySelector('#modalClose').addEventListener('click', closeModal);
  
  // Tür seçim eventleri
  let selectedType = 'oyster';
  const updateRecipe = () => {
    const t = MUSHROOM_TYPES[selectedType];
    const recipe = getRecipeForType(selectedType);
    const climate = CONTAINER_LEVELS[cont.level].climate;
    const totalYield = t.flushYield.reduce((a, b) => a + b, 0);
    let recHtml = `<div class="recipe"><b>${t.latin}</b><br>${t.desc}<br>`;
    recHtml += `<b>Sıcaklık:</b> ${t.temps}<br>`;
    recHtml += `<b>Reçete:</b> ` + Object.entries(recipe)
      .map(([mat, qty]) => `${qty} ${MATERIALS[mat].unit} ${MATERIALS[mat].name}`).join(' · ');
    recHtml += `<br><b>Misel:</b> 0.3 kg (soğutma sonrası)`;
    recHtml += `<br><b>Flaş:</b> ${t.flushYield.length} · <b>Toplam verim:</b> ~${totalYield.toFixed(1)} kg · <b>Fiyat:</b> ×${t.priceMult.toFixed(2)}</div>`;

    if (climate < t.climateMin) {
      recHtml += `<div class="hint warn">Bu konteynerin iklimi (%${Math.round(climate*100)}) bu tür için yetersiz (önerilen en az %${Math.round(t.climateMin*100)}). Verim ciddi şekilde düşer; konteyneri yükseltmeyi düşün.</div>`;
    }

    // Malzeme kontrolü
    let missing = false;
    for (const [mat, qty] of Object.entries(recipe)) {
      if ((state.inventory[mat]||0) < qty) { missing = true; break; }
    }

    if (missing) recHtml += `<div class="hint danger">Malzeme eksik.</div>`;
    
    recHtml += `<div style="font-size:0.68rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">Pastörizasyon</div>`;
    
    Object.entries(METHODS).forEach(([mKey, m]) => {
      const disabled = missing || state.money < m.cost;
      recHtml += `
        <div class="method ${disabled?'disabled':''}" ${disabled?'':'data-action="createBatchIn" data-method="'+mKey+'" data-type="'+selectedType+'" data-container="'+cont.id+'"'}>
          <div class="m-ico">${m.icon}</div>
          <div class="m-info">
            <div class="m-name">${m.name}</div>
            <div class="m-desc">${m.desc} · ${Math.round(m.duration * t.prepMult)}sn${m.cost?' · +₺'+m.cost:''} · Risk %${riskPercent(estimateContamRisk(selectedType, mKey, cont.id))}</div>
          </div>
        </div>
      `;
    });
    modalEl.querySelector('#recipeBox').innerHTML = recHtml;
  };
  
  modalEl.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      selectedType = e.target.dataset.type;
      modalEl.querySelectorAll('.type-btn').forEach(b => b.classList.replace('btn-green','btn-ghost'));
      e.target.classList.replace('btn-ghost','btn-green');
      updateRecipe();
    });
  });
  
  updateRecipe();
}

export function openBatchModal(id) {
  const b = state.batches.find(x => x.id === id);
  if (!b) return;
  const ph = PHASES[b.phase] || { label: '?' };
  const risk = currentContamRisk(b);
  const typeData = MUSHROOM_TYPES[b.mushroomType];
  const timeLeft = batchTimeLabel(b);

  let actionHtml = '';
  if (b.phase === 'cooled') actionHtml = `<button class="btn btn-green" style="width:100%;margin-bottom:8px" data-action="inoculateModal" data-id="${b.id}">Misel Ek (0.3 kg)</button>`;
  else if (b.phase === 'ready') actionHtml = `<button class="btn btn-green" style="width:100%;margin-bottom:8px" data-action="harvestModal" data-id="${b.id}">Hasat Et</button>`;
  else if (b.phase === 'spent') actionHtml = `<button class="btn btn-green" style="width:100%;margin-bottom:8px" data-action="manualRestartModal" data-id="${b.id}">Yeniden Başlat</button>`;
  else if (b.phase === 'contaminated') actionHtml = `<button class="btn btn-danger" style="width:100%;margin-bottom:8px" data-action="removeModal" data-id="${b.id}">Kaldır</button>`;

  modalEl.innerHTML = `
    <h2>${typeData.icon} ${typeData.name}</h2>
    <span class="sub">Konteyner #${b.containerId} · Flaş ${Math.min(b.flush, typeData.flushYield.length)}/${typeData.flushYield.length}</span>
    <div class="batch-detail">
      <div class="bd-row"><span class="k">Aşama</span><span class="v">${ph.label}</span></div>
      <div class="bd-row"><span class="k">Yöntem</span><span class="v">${METHODS[b.method].name}</span></div>
      <div class="bd-row"><span class="k">İlerleme</span><span class="v">${Math.round(b.progress||0)}%</span></div>
      <div class="bd-row"><span class="k">Kalan süre</span><span class="v">${timeLeft}</span></div>
      <div class="bd-row"><span class="k">Kontaminasyon riski</span><span class="v ${risk>0.1?'danger':'green'}">%${Math.round(risk*100)}</span></div>
    </div>
    ${actionHtml}
    <button class="close" id="modalClose">Kapat</button>
  `;
  modalBack.classList.add('on');
  modalEl.querySelector('#modalClose').addEventListener('click', closeModal);
}

export function openUpgradeModal(containerId) {
  const cont = state.containers.find(c => c.id === containerId);
  if (!cont) return;
  const curr = CONTAINER_LEVELS[cont.level];
  const next = CONTAINER_LEVELS[cont.level + 1];

  if (!next) {
    modalEl.innerHTML = `
      <h2>Yükselt</h2>
      <span class="sub">Konteyner #${cont.id}</span>
      <div class="hint">Bu konteyner maksimum seviyede.</div>
      <button class="close" id="modalClose">Kapat</button>
    `;
    modalBack.classList.add('on');
    modalEl.querySelector('#modalClose').addEventListener('click', closeModal);
    return;
  }

  const canAfford = state.money >= next.cost;
  const fmtShort = n => '₺' + fmt(n);

  modalEl.innerHTML = `
    <h2>Yükselt</h2>
    <span class="sub">Konteyner #${cont.id}</span>
    <div class="upgrade-compare">
      <div class="col">
        <h4>Mevcut · Sv.${cont.level}</h4>
        <div class="row"><span class="k">Kapasite</span><span class="v">${curr.capacity} kg</span></div>
        <div class="row"><span class="k">Depo</span><span class="v">${curr.storage} kg</span></div>
        <div class="row"><span class="k">İklim</span><span class="v">%${Math.round(curr.climate*100)}</span></div>
        <div class="row"><span class="k">Fiyat</span><span class="v">+%${Math.round(curr.priceBonus*100)}</span></div>
      </div>
      <div class="col">
        <h4>Sonraki · Sv.${cont.level+1}</h4>
        <div class="row"><span class="k">Kapasite</span><span class="v up">${next.capacity} kg</span></div>
        <div class="row"><span class="k">Depo</span><span class="v up">${next.storage} kg</span></div>
        <div class="row"><span class="k">İklim</span><span class="v up">%${Math.round(next.climate*100)}</span></div>
        <div class="row"><span class="k">Fiyat</span><span class="v up">+%${Math.round(next.priceBonus*100)}</span></div>
      </div>
    </div>
    <div class="upgrade-cost">
      <div class="lbl">Maliyet</div>
      <div class="val ${canAfford?'':'poor'}">${fmtShort(next.cost)}</div>
    </div>
    <button class="btn btn-green" style="width:100%;margin-bottom:8px" data-action="doUpgrade" data-id="${cont.id}" ${canAfford?'':'disabled'}>
      ${canAfford ? 'Yükselt' : 'Para Yetersiz'}
    </button>
    <button class="close" id="modalClose">İptal</button>
  `;
  modalBack.classList.add('on');
  modalEl.querySelector('#modalClose').addEventListener('click', closeModal);
}

export function closeModal() { modalBack.classList.remove('on'); }

/* ---------- EVENTS ---------- */
export function setupEvents() {
  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === btn));
    render();
  });

  tabContent.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;

    if (a === 'openContainer') {
      uretimView = 'container';
      viewingContainerId = parseInt(btn.dataset.id);
      renderUretim();
    }
    else if (a === 'exitContainer') {
      uretimView = 'list';
      viewingContainerId = null;
      renderUretim();
    }
    else if (a === 'openUpgrade') openUpgradeModal(parseInt(btn.dataset.id));
    else if (a === 'openBatch') openBatchModal(parseFloat(btn.dataset.id));
    else if (a === 'newBatchIn') openNewBatchModal(parseInt(btn.dataset.container));
    else if (a === 'buyContainer') buyNewContainer(parseInt(btn.dataset.plot));
    else if (a === 'togglePlot') {
      const plate = parseInt(btn.dataset.plot);
      if (expandedPlots.has(plate)) expandedPlots.delete(plate); else expandedPlots.add(plate);
      renderUretim();
    }
    else if (a === 'selectProvince') {
      if (mapDragged) { mapDragged = false; return; }   // sürükleme, tıklama değil
      selectedPlate = parseInt(btn.dataset.plate);
      renderArsalar();
    }
    else if (a === 'closePanel') { selectedPlate = null; renderArsalar(); }
    else if (a === 'buyPlot') buyPlot(parseInt(btn.dataset.plate));
    else if (a === 'goPlot') goToProduction(parseInt(btn.dataset.plate));
    else if (a === 'mapZoomIn')  zoomMap(tabContent.querySelector('#trMap'), 1.5);
    else if (a === 'mapZoomOut') zoomMap(tabContent.querySelector('#trMap'), 1 / 1.5);
    else if (a === 'mapReset') { mapView.x = 0; mapView.y = 0; mapView.w = MAP_W; renderArsalar(); }
    else if (a === 'skipDay') { for (let i = 0; i < 12; i++) advanceState(); render(); save(); }
    else if (a === 'sell') sellMushrooms(btn.dataset.qty === 'all' ? 'all' : parseInt(btn.dataset.qty));
    else if (a === 'remove') removeBatch(parseFloat(btn.dataset.id));
    else if (a === 'cartAdd') addToCart(btn.dataset.mat, parseInt(btn.dataset.qty));
    else if (a === 'cartAddCustom') {
      const mat = btn.dataset.mat;
      const input = tabContent.querySelector('.qty-input[data-mat="' + mat + '"]');
      const raw = input.value.trim().replace(',', '.');
      const qty = Number(raw);
      const wholeOnly = MATERIALS[mat]?.unit === 'adet';
      if (!Number.isFinite(qty) || qty <= 0 || (wholeOnly && !Number.isInteger(qty))) { alert(wholeOnly ? 'Adet miktarı tam sayı olmalı.' : '0’dan büyük geçerli bir miktar gir. Örn. 0,5'); return; }
      addToCart(mat, qty);
    }
    else if (a === 'cartRemove') { delete state.cart[btn.dataset.mat]; save(); renderPazar(); }
    else if (a === 'cartClear') { state.cart = {}; save(); renderPazar(); }
    else if (a === 'cartBuy') buyCart();
    else if (a === 'hireMaster') {
      const targetSelect = document.getElementById(btn.dataset.targetSelect);
      hireMaster(parseFloat(btn.dataset.id), targetSelect?.value);
    }
    else if (a === 'fireMaster') fireMaster(parseFloat(btn.dataset.id));
  });

  tabContent.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('qty-input') && e.key === 'Enter') {
      e.preventDefault();
      const mat = e.target.dataset.mat;
      const raw = e.target.value.trim().replace(',', '.');
      const qty = Number(raw);
      const wholeOnly = MATERIALS[mat]?.unit === 'adet';
      if (!Number.isFinite(qty) || qty <= 0 || (wholeOnly && !Number.isInteger(qty))) return;
      addToCart(mat, qty);
    }
  });

  modalBack.addEventListener('click', (e) => { if (e.target === modalBack) closeModal(); });

  modalEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'createBatchIn') createBatch(btn.dataset.method, parseInt(btn.dataset.container), btn.dataset.type);
    else if (a === 'doUpgrade') { doUpgrade(parseInt(btn.dataset.id)); closeModal(); }
    else if (a === 'inoculateModal') { if (inoculate(parseFloat(btn.dataset.id), false)) { closeModal(); render(); save(); } }
    else if (a === 'harvestModal') { if (harvest(parseFloat(btn.dataset.id), false)) { closeModal(); render(); save(); } }
    else if (a === 'manualRestartModal') { manualRestart(parseFloat(btn.dataset.id)); closeModal(); }
    else if (a === 'removeModal') { removeBatch(parseFloat(btn.dataset.id)); closeModal(); }
  });

  document.getElementById('speedGroup').addEventListener('click', (e) => {
    const btn = e.target.closest('.speed-btn');
    if (!btn) return;
    setSpeed(parseInt(btn.dataset.speed));
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Tüm ilerleme silinecek. Emin misin?')) return;
    resetState();
    uretimView = 'list';
    viewingContainerId = null;
    expandedPlots.clear();
    selectedPlate = null;
    mapView.x = 0; mapView.y = 0; mapView.w = MAP_W;
    render();
  });
}

export function setSpeed(s) {
  state.speed = s;
  save();
  startInterval();
  renderHUD();
}

function startInterval() {
  if (logicInterval) clearInterval(logicInterval);
  logicInterval = setInterval(() => advanceState(), 1000 / (state.speed || 1));
}

/* ---------- INIT ---------- */
export async function init(uid) {
  await load(uid);
  render();
  setupEvents();
  startInterval();
  setInterval(() => renderLive(), 250);
  setInterval(() => save(), 5000);
  window.addEventListener('beforeunload', save);
  initChat();
}

function getPhaseIcon(b) {
  if (b.phase === 'ready') return MUSHROOM_TYPES[b.mushroomType]?.icon || '🍄';
  switch (b.phase) {
    case 'pasteurizing': return '♨️';
    case 'cooling':      return '❄️';
    case 'cooled':       return '🧊';
    case 'incubating':   return '🧫';
    case 'pinning':      return '🌱';
    case 'fruiting':     return '🍄';
    case 'resting':      return '💤';
    case 'spent':        return '💀';
    case 'contaminated': return '❌';
    default: return '?';
  }
    }
