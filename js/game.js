import {
  state, save, load, resetState,
  refreshMarket, refreshMasterPool,
  getMaterialPrice, getMushroomSalePrice,
  containerById, totalStorageCap, storageUsed,
  activeSubstrateIn, totalActiveSubstrate, findContainerWithSpace,
  hasMaterials, consumeMaterials,
  fmt, fmtMoney, generateMaster,
  computeDuration, currentContamRisk, getSpeedMultiplier,
  advanceOffline
} from './core.js';

import {
  MATERIALS, RECIPE, METHODS, PHASES, CONTAINER_LEVELS,
  MAX_CONTAINERS, NEW_CONTAINER_COST,
  MASTER_TYPES, STAR_SPEED, RESTART_MODES
} from './data.js';

import { initChat } from './chat.js';

let activeTab = 'uretim';
let currentSpeed = 1;
let logicInterval = null;

const tabContent = document.getElementById('tabContent');
const modalBack = document.getElementById('modalBack');
const modalEl = document.getElementById('modal');

/* ---------- ADVANCE STATE ---------- */
export function advanceState() {
  state.tickCount++;
  const prevDay = state.day;
  if (state.tickCount % 12 === 0) state.day++;

  if (state.day !== prevDay) {
    // Maaşlar
    let salary = 0;
    state.masters.forEach(m => salary += m.salary);
    if (salary > 0) state.money -= salary;

    // Piyasa her 60 gün
    if (state.day % 60 === 0) {
      refreshMarket();
      state._marketChanged = true;
    }
    // Usta havuzu her 7 gün
    if (state.day % 7 === 0) {
      refreshMasterPool();
      state.lastMasterRefreshDay = state.day;
    }
  }

  // Parti fazları
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
export function createBatch(method) {
  if (!hasMaterials()) { alert('Malzeme eksik. Pazar sekmesinden al.'); return; }
  const cont = findContainerWithSpace();
  if (!cont) { alert('Tüm konteynerler dolu.'); return; }
  const m = METHODS[method];
  if (state.money < m.cost) { alert('Ek maliyet için para yetersiz.'); return; }

  consumeMaterials();
  state.money -= m.cost;

  const b = {
    id: Date.now() + Math.random(),
    containerId: cont.id,
    phase: 'pasteurizing',
    progress: 0,
    duration: m.duration,
    method,
    contamRisk: 0,
    flush: 1,
    logs: [`Kompost karıştırıldı. ${m.name} başladı. Konteyner #${cont.id}.`]
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
  if (state.inventory.spawn < 0.3) {
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

  const base = [2.2, 1.2, 0.6][b.flush - 1] || 0;
  const cont = state.containers.find(c => c.id === b.containerId);
  const contLevel = CONTAINER_LEVELS[cont ? cont.level : 1];
  const climateMult = 0.6 + contLevel.climate * 0.6;
  const harvMaster = state.masters.find(m => m.type === 'harvest');
  const yieldBonus = harvMaster ? 1 + (harvMaster.stars - 1) * 0.03 : 1;
  const yieldKg = +(base * climateMult * yieldBonus).toFixed(2);

  if (storageUsed() + yieldKg > totalStorageCap()) {
    if (!silent) alert('Depo dolu! Önce mantar sat.');
    else b.logs.push('⚠️ Depo dolu, usta hasat edemedi.');
    return false;
  }

  state.inventory.mushroom += yieldKg;
  b.flush += 1;
  b.logs.push(silent
    ? `🍄 Usta hasat etti: ${yieldKg} kg (Flaş ${b.flush - 1}).`
    : `Hasat: ${yieldKg} kg mantar (Flaş ${b.flush - 1}).`);

  if (b.flush > 3) {
    b.phase = 'spent'; b.progress = 0;
    b.logs.push('3 flaş tamamlandı. Parti tükendi.');
    handleBatchRestart(b);
  } else {
    b.phase = 'resting'; b.progress = 0;
    b.logs.push('Parti dinlenmeye alındı.');
  }
  return true;
}

function handleBatchRestart(b) {
  if (state.masters.length === 0) return;
  const mode = state.masterRestart || 'stop';
  if (mode === 'stop') { b.logs.push('Durdur modu: yeni parti yok.'); return; }
  if (mode === 'autobuy') tryBuyRecipeForRestart();
  if (!hasMaterials()) { b.logs.push('Malzeme yok, yeni parti başlatılamadı.'); return; }
  consumeMaterials();
  const method = state.masterMethod || 'hot';
  b.phase = 'pasteurizing';
  b.method = method;
  b.progress = 0;
  b.flush = 1;
  b.logs.push('🔄 Yeni parti başlatıldı: ' + METHODS[method].name + '.');
}

function tryBuyRecipeForRestart() {
  const need = {};
  let missing = false;
  for (const [mat, qty] of Object.entries(RECIPE)) {
    const have = state.inventory[mat] || 0;
    if (have < qty) { need[mat] = qty - have; missing = true; }
  }
  if (state.masters.some(m => m.type === 'inoculate')) {
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
  if (!hasMaterials()) { alert('Malzeme yok. Pazar’dan al.'); return; }
  consumeMaterials();
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
export function hireMaster(id) {
  const idx = state.availableMasters.findIndex(m => m.id === id);
  if (idx === -1) return;
  const master = state.availableMasters[idx];
  if (state.masters.some(m => m.type === master.type)) {
    alert(`Zaten bir ${MASTER_TYPES[master.type].name} var.`);
    return;
  }
  state.masters.push(master);
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
  const inoc = state.masters.find(m => m.type === 'inoculate');
  const harv = state.masters.find(m => m.type === 'harvest');
  state.batches.forEach(b => {
    if (b.phase === 'cooled' && inoc) inoculate(b.id, true);
    if (b.phase === 'ready' && harv) harvest(b.id, true);
  });
}

/* ---------- PAZAR ---------- */
export function addToCart(mat, qty) {
  if (!state.cart) state.cart = {};
  state.cart[mat] = (state.cart[mat] || 0) + qty;
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
  const amount = qty === 'all' ? state.inventory.mushroom : Math.min(qty, state.inventory.mushroom);
  if (amount <= 0) return;
  const pricePerKg = getMushroomSalePrice();
  state.money += amount * pricePerKg;
  state.inventory.mushroom -= amount;
  render(); save();
}

/* ---------- KONTEYNER ---------- */
export function upgradeContainer(containerId) {
  const cont = state.containers.find(c => c.id === containerId);
  if (!cont) return;
  const next = cont.level + 1;
  if (next >= CONTAINER_LEVELS.length) return;
  const lvl = CONTAINER_LEVELS[next];
  if (state.money < lvl.cost) { alert('Para yetersiz.'); return; }
  if (!confirm(`${lvl.name} için ${fmtMoney(lvl.cost)} ödenecek. Onaylıyor musun?`)) return;
  state.money -= lvl.cost;
  cont.level = next;
  render(); save();
}
export function buyNewContainer() {
  if (state.containers.length >= MAX_CONTAINERS) { alert('Maksimum konteyner sayısı.'); return; }
  if (state.money < NEW_CONTAINER_COST) { alert('Para yetersiz.'); return; }
  if (!confirm(`Yeni konteyner için ${fmtMoney(NEW_CONTAINER_COST)} ödenecek.`)) return;
  state.money -= NEW_CONTAINER_COST;
  const newId = Math.max(...state.containers.map(c => c.id), 0) + 1;
  state.containers.push({ id: newId, level: 1 });
  render(); save();
}

/* ---------- RENDER ---------- */
export function renderHUD() {
  const moneyEl = document.getElementById('statMoney');
  moneyEl.textContent = fmtMoney(state.money);
  moneyEl.classList.toggle('danger', state.money < 0);
  moneyEl.classList.toggle('gold', state.money >= 0);
  document.getElementById('statDay').textContent = state.day;
  document.getElementById('statPrice').textContent = '₺' + Math.round(getMushroomSalePrice()) + '/kg';
  document.getElementById('statContainer').textContent = state.containers.length;
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.speed) === state.speed);
  });
}

export function render() {
  renderHUD();
  if (activeTab === 'uretim') renderUretim();
  else if (activeTab === 'pazar') renderPazar();
  else if (activeTab === 'ustalar') renderUstalar();
  else if (activeTab === 'konteyner') renderKonteyner();
  else if (activeTab === 'depo') renderDepo();
}

export function renderLive() {
  renderHUD();
  if (activeTab === 'uretim') renderUretim();
  else if (activeTab === 'depo') renderDepo();
  else if (activeTab === 'pazar' && state._marketChanged) {
    renderPazar();
    state._marketChanged = false;
  } else if (activeTab === 'ustalar' && state._masterPoolChanged) {
    renderUstalar();
    state._masterPoolChanged = false;
  }
}

export function renderUretim() {
  let html = `
    <div class="section-head">
      <h2>Üretim</h2>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-ghost" data-action="skipDay">⏩ 1 Gün</button>
        <button class="btn btn-green" data-action="newBatch">+ Yeni Parti</button>
      </div>
    </div>
  `;

  if (state.batches.length === 0) {
    html += `<div class="hint">Henüz parti yok. <b>Pazar</b>'dan malzeme al, sonra <b>+ Yeni Parti</b>.</div>`;
  }

  const totCap = state.containers.reduce((s, c) => s + CONTAINER_LEVELS[c.level].capacity, 0);
  html += `<div class="hint">Aktif substrat: <b>${totalActiveSubstrate()} / ${totCap} kg</b> · Depo: <b>${storageUsed().toFixed(1)} / ${totalStorageCap()} kg</b></div>`;

  state.batches.forEach(b => {
    const ph = PHASES[b.phase] || { label: '?' };
    const isBad = b.phase === 'contaminated';
    const isReady = b.phase === 'ready';
    const isSpent = b.phase === 'spent';
    const timeLeft = b.duration && !['cooled','ready','spent','contaminated'].includes(b.phase)
      ? Math.ceil((100 - b.progress) / 100 * b.duration) + 'sn'
      : '';
    const risk = currentContamRisk(b);

    let actions = '';
    if (b.phase === 'cooled') actions += `<button class="btn btn-green" data-action="inoculate" data-id="${b.id}">Misel Ek (0.3 kg)</button>`;
    if (b.phase === 'ready')  actions += `<button class="btn btn-green" data-action="harvest" data-id="${b.id}">Hasat Et</button>`;
    if (isSpent) actions += `<button class="btn btn-green" data-action="manualRestart" data-id="${b.id}">Yeniden Başlat</button>`;
    if (['spent','contaminated'].includes(b.phase)) actions += `<button class="btn btn-danger" data-action="remove" data-id="${b.id}">Kaldır</button>`;

    html += `
      <div class="batch ${isBad?'contaminated':''} ${isReady?'ready':''}" data-id="${b.id}">
        <div class="batch-head">
          <span class="title">Parti · Flaş ${b.flush}/3 · K${b.containerId}</span>
          <span class="phase ${isBad?'bad':''}">${ph.label}</span>
        </div>
        <div class="bar"><div class="fill ${isBad?'bad':''}" style="width:${b.progress||0}%"></div></div>
        <div class="batch-info">
          <span>${METHODS[b.method].name} · Risk %${Math.round(risk*100)}</span>
          <span>${timeLeft}</span>
        </div>
        <div class="batch-log">${b.logs[b.logs.length-1] || ''}</div>
        <div class="batch-actions">${actions}</div>
      </div>
    `;
  });

  tabContent.innerHTML = html;
}

export function renderPazar() {
  let html = `<div class="section-head"><h2>Pazar</h2></div>`;
  const next = 60 - (state.day % 60);
  html += `<div class="hint">
    Piyasa döngüsü: <b>Flaş başına ~₺${state.market.profitPerFlush}</b> kâr ·
    Malzeme katsayısı <b>${state.market.materialMult.toFixed(2)}×</b> ·
    Sonraki değişim: <b>${next} gün</b>
  </div>`;

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
          <input type="number" class="qty-input" data-mat="${key}" placeholder="Miktar..." min="1" inputmode="numeric" />
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
          <span>${m.icon} ${m.name} × ${q}</span>
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

export function renderUstalar() {
  let html = `<div class="section-head"><h2>Ustalar</h2></div>`;

  const totalSalary = state.masters.reduce((s, m) => s + m.salary, 0);
  if (totalSalary > 0) {
    html += `<div class="hint ${state.money < totalSalary ? 'danger' : ''}">
      Günlük maaş: <b>₺${totalSalary}</b>${state.money < totalSalary ? ' · ⚠️ Bakiye düşük!' : ''}
    </div>`;
  } else {
    html += `<div class="hint">Usta kiralamadın. Ustalar misel ekme ve hasat işlerini otomatikleştirir.</div>`;
  }

  // Usta davranışı
  html += `<div style="font-family:var(--font-head);font-size:0.82rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--green-bright);margin:14px 0 8px">Usta Davranışı</div>`;
  html += `
    <div class="setting-row">
      <label>Parti Bitince (3. Flaştan Sonra)</label>
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

  // Kiralanan
  html += `<div style="font-family:var(--font-head);font-size:0.82rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--green-bright);margin:14px 0 8px">Kiralanan (${state.masters.length})</div>`;
  if (state.masters.length === 0) {
    html += `<div style="font-size:0.72rem;color:var(--muted);padding:8px 0">Henüz usta yok.</div>`;
  } else {
    state.masters.forEach(m => {
      const t = MASTER_TYPES[m.type];
      const stars = '★'.repeat(m.stars) + '☆'.repeat(5 - m.stars);
      let effect = m.type === 'inoculate'
        ? `Kuluçka <b>${STAR_SPEED[m.stars].toFixed(2)}×</b> · Risk <b>-%${(m.stars-1)*2}</b>`
        : `Pin+Meyveleme <b>${STAR_SPEED[m.stars].toFixed(2)}×</b> · Verim <b>+%${(m.stars-1)*3}</b>`;
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

  // Havuz
  const nextRefresh = state.lastMasterRefreshDay + 7 - state.day;
  html += `<div style="font-family:var(--font-head);font-size:0.82rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--green-bright);margin:18px 0 4px">Kiralık Ustalar</div>`;
  html += `<div style="font-size:0.66rem;color:var(--muted);margin-bottom:10px">Yenilenmeye <b>${Math.max(0, nextRefresh)} gün</b> (her 7 gün).</div>`;

  state.availableMasters.forEach(m => {
    const t = MASTER_TYPES[m.type];
    const stars = '★'.repeat(m.stars) + '☆'.repeat(5 - m.stars);
    const has = state.masters.some(x => x.type === m.type);
    let effect = m.type === 'inoculate'
      ? `Kuluçka <b>${STAR_SPEED[m.stars].toFixed(2)}×</b> · Risk <b>-%${(m.stars-1)*2}</b>`
      : `Pin+Meyveleme <b>${STAR_SPEED[m.stars].toFixed(2)}×</b> · Verim <b>+%${(m.stars-1)*3}</b>`;
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
          ${has
            ? `<button class="btn btn-ghost" disabled>Bu tip zaten var</button>`
            : `<button class="btn btn-green" data-action="hireMaster" data-id="${m.id}">Kirala</button>`}
        </div>
      </div>
    `;
  });

  tabContent.innerHTML = html;

  // Wire up settings
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

export function renderKonteyner() {
  let html = `<div class="section-head"><h2>Konteyner</h2></div>`;
  html += `<div class="hint">Her konteyner bağımsız yükseltilir. Yeni konteyner L1'den başlar.</div>`;

  state.containers.forEach(c => {
    const lvl = CONTAINER_LEVELS[c.level];
    const next = CONTAINER_LEVELS[c.level + 1];
    const active = activeSubstrateIn(c.id);
    html += `
      <div class="container-card">
        <h3>Konteyner #${c.id}</h3>
        <span class="lvl">${lvl.name} · Sv.${c.level}/${CONTAINER_LEVELS.length - 1}</span>
        <div class="stat-grid">
          <div class="stat-cell"><div class="k">Substrat</div><div class="v">${active}/${lvl.capacity} kg</div></div>
          <div class="stat-cell"><div class="k">Depo</div><div class="v">${lvl.storage} kg</div></div>
          <div class="stat-cell"><div class="k">İklim</div><div class="v">%${Math.round(lvl.climate*100)}</div></div>
          <div class="stat-cell"><div class="k">Fiyat Bonusu</div><div class="v">+%${Math.round(lvl.priceBonus*100)}</div></div>
        </div>
        ${next ? `
          <div class="upgrade-box">
            <h4>${next.name}</h4>
            <p>Kapasite ${next.capacity} kg · Depo ${next.storage} kg · İklim %${Math.round(next.climate*100)}${next.priceBonus?' · Fiyat +%'+Math.round(next.priceBonus*100):''}</p>
            <div class="cost">${fmtMoney(next.cost)}</div>
            <button class="btn btn-green" data-action="upgradeContainer" data-id="${c.id}">Yükselt</button>
          </div>
        ` : `<div class="hint">Maksimum seviyede.</div>`}
      </div>
    `;
  });

  if (state.containers.length < MAX_CONTAINERS) {
    html += `
      <div class="upgrade-box" style="margin-top:14px">
        <h4>+ Yeni Konteyner (${state.containers.length}/${MAX_CONTAINERS})</h4>
        <p>L1 temel konteyner. 50 kg substrat. Ayrıca yükseltilir.</p>
        <div class="cost">${fmtMoney(NEW_CONTAINER_COST)}</div>
        <button class="btn btn-green" data-action="buyContainer">Satın Al</button>
      </div>
    `;
  }

  tabContent.innerHTML = html;
}

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
  tabContent.innerHTML = html;
}

/* ---------- MODAL ---------- */
export function openNewBatch() {
  const missing = [];
  if (state.inventory.straw < RECIPE.straw) missing.push(`${RECIPE.straw} kg saman`);
  if (state.inventory.bran < RECIPE.bran) missing.push(`${RECIPE.bran} kg kepek`);
  if (state.inventory.gypsum < RECIPE.gypsum) missing.push(`${RECIPE.gypsum} kg alçı`);
  if (state.inventory.lime < RECIPE.lime) missing.push(`${RECIPE.lime} kg kireç`);
  if (state.inventory.bag < RECIPE.bag) missing.push(`${RECIPE.bag} poşet`);

  const targetCont = findContainerWithSpace();

  let html = `
    <h2>Yeni Parti</h2>
    <span class="sub">10 kg substrat · İstiridye mantarı</span>
    <div class="recipe">
      <b>Reçete:</b> 7 kg saman · 2 kg kepek · 0.5 kg alçı · 0.5 kg kireç · 4 poşet<br>
      <b>Misel:</b> 0.3 kg (soğutma sonrası)<br>
      <b>Konteyner:</b> ${targetCont ? 'Konteyner #' + targetCont.id : '❌ Tüm konteynerler dolu'}
    </div>
  `;

  if (missing.length) html += `<div class="hint danger">Eksik: <b>${missing.join(', ')}</b></div>`;
  if (!targetCont) html += `<div class="hint danger">Tüm konteynerler dolu.</div>`;

  html += `<div style="font-size:0.68rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">Pastörizasyon</div>`;

  Object.entries(METHODS).forEach(([key, m]) => {
    const disabled = missing.length || !targetCont || state.money < m.cost;
    html += `
      <div class="method ${disabled?'disabled':''}" ${disabled?'':'data-action="createBatch" data-method="'+key+'"'}>
        <div class="m-ico">${m.icon}</div>
        <div class="m-info">
          <div class="m-name">${m.name}</div>
          <div class="m-desc">${m.desc} · ${m.duration}sn${m.cost?' · +₺'+m.cost:''}</div>
        </div>
      </div>
    `;
  });

  html += `<button class="close" id="modalClose">Kapat</button>`;
  modalEl.innerHTML = html;
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
    if (a === 'newBatch') openNewBatch();
    else if (a === 'skipDay') { for (let i = 0; i < 12; i++) advanceState(); render(); save(); }
    else if (a === 'sell') sellMushrooms(btn.dataset.qty === 'all' ? 'all' : parseInt(btn.dataset.qty));
    else if (a === 'upgradeContainer') upgradeContainer(parseInt(btn.dataset.id));
    else if (a === 'buyContainer') buyNewContainer();
    else if (a === 'inoculate') { if (inoculate(parseFloat(btn.dataset.id), false)) { render(); save(); } }
    else if (a === 'harvest') { if (harvest(parseFloat(btn.dataset.id), false)) { render(); save(); } }
    else if (a === 'remove') removeBatch(parseFloat(btn.dataset.id));
    else if (a === 'manualRestart') manualRestart(parseFloat(btn.dataset.id));
    else if (a === 'cartAdd') addToCart(btn.dataset.mat, parseInt(btn.dataset.qty));
    else if (a === 'cartAddCustom') {
      const mat = btn.dataset.mat;
      const input = tabContent.querySelector('.qty-input[data-mat="' + mat + '"]');
      const qty = parseInt(input.value);
      if (!qty || qty < 1) { alert('Geçerli miktar gir.'); return; }
      addToCart(mat, qty);
    }
    else if (a === 'cartRemove') { delete state.cart[btn.dataset.mat]; save(); renderPazar(); }
    else if (a === 'cartClear') { state.cart = {}; save(); renderPazar(); }
    else if (a === 'cartBuy') buyCart();
    else if (a === 'hireMaster') hireMaster(parseFloat(btn.dataset.id));
    else if (a === 'fireMaster') fireMaster(parseFloat(btn.dataset.id));
  });

  tabContent.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('qty-input') && e.key === 'Enter') {
      e.preventDefault();
      const mat = e.target.dataset.mat;
      const qty = parseInt(e.target.value);
      if (!qty || qty < 1) return;
      addToCart(mat, qty);
    }
  });

  modalBack.addEventListener('click', (e) => { if (e.target === modalBack) closeModal(); });
  modalEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="createBatch"]');
    if (!btn) return;
    createBatch(btn.dataset.method);
  });

  document.getElementById('speedGroup').addEventListener('click', (e) => {
    const btn = e.target.closest('.speed-btn');
    if (!btn) return;
    setSpeed(parseInt(btn.dataset.speed));
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Tüm ilerleme silinecek. Emin misin?')) return;
    resetState();
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
export function init() {
  load();
  render();
  setupEvents();
  startInterval();
  setInterval(() => renderLive(), 250);
  setInterval(() => save(), 5000);
  window.addEventListener('beforeunload', save);
  initChat();
}
