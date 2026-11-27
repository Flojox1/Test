import { state, save } from './core.js';

const SHELTER_COST = 280000;
const ORDERS = [
  {
    name: 'İstiridye Mantarı Siparişi',
    type: 'oyster',
    mushroom: 'İstiridye Mantarı',
    kg: 270,
    unlocks: ['rack', 'fan']
  },
  {
    name: 'Kral İstiridye Mantarı Siparişi',
    type: 'king',
    mushroom: 'Kral İstiridye',
    kg: 300,
    unlocks: ['workbench', 'botanical']
  }
];

const ITEMS = {
  rack: { name: 'Yetiştirme Rafı', icon: '🗄️', price: 45000, unlockOrder: 1 },
  fan: { name: 'Havalandırma Ünitesi', icon: '🌀', price: 90000, unlockOrder: 1 },
  workbench: { name: 'Hazırlık Tezgâhı', icon: '🛠️', price: 125000, unlockOrder: 2 },
  botanical: { name: 'Özel Botanik Birimi', icon: '🌱', price: 18000, unlockOrder: 2 }
};

function economy() {
  if (!state.empire || typeof state.empire !== 'object') state.empire = {};
  if (!state.empire.economy || typeof state.empire.economy !== 'object') state.empire.economy = {};
  const e = state.empire.economy;
  if (!e.shelters || typeof e.shelters !== 'object' || Array.isArray(e.shelters)) e.shelters = {};
  if (!Number.isInteger(e.mehmetOrderIndex)) e.mehmetOrderIndex = 0;
  if (!e.mehmetInventory || typeof e.mehmetInventory !== 'object') e.mehmetInventory = {};
  delete e.mehmetPendingRewards;
  delete e.reputation;
  Object.keys(ITEMS).forEach(key => {
    if (!Number.isFinite(Number(e.mehmetInventory[key]))) e.mehmetInventory[key] = 0;
  });
  return e;
}

function shelterFor(containerId) {
  const container = getContainer(containerId);
  if (!container) return null;

  // Sığınağı doğrudan konteyner kaydında tut; eski kayıtları da koruyup taşı.
  if (container.shelter && typeof container.shelter === 'object') {
    economy().shelters[String(containerId)] = container.shelter;
    return container.shelter;
  }

  const legacyShelter = economy().shelters[String(containerId)];
  if (legacyShelter && typeof legacyShelter === 'object') {
    container.shelter = legacyShelter;
    save();
    return container.shelter;
  }
  return null;
}

function getContainer(containerId) {
  return state.containers.find(item => Number(item.id) === Number(containerId));
}

function ensureShelterLayout(shelter) {
  if (!shelter.installed || typeof shelter.installed !== 'object') shelter.installed = {};
  if (!Array.isArray(shelter.racks)) shelter.racks = [];
  const count = Math.max(0, Number(shelter.installed.rack) || 0);
  while (shelter.racks.length < count) shelter.racks.push({ id: shelter.racks.length + 1, slots: [0, 0] });
  shelter.racks.forEach((rack, i) => { rack.id = rack.id || i + 1; if (!Array.isArray(rack.slots)) rack.slots = [0, 0]; rack.slots = [0,1].map(n => Math.min(2, Math.max(0, Number(rack.slots[n]) || 0))); });
  shelter.installed.rack = shelter.racks.length;
  shelter.installed.fan = Math.max(0, Number(shelter.installed.fan) || 0);
  shelter.installed.workbench = Math.min(1, Math.max(0, Number(shelter.installed.workbench) || 0));
  return shelter;
}

function renderShelterPage(containerId) {
  const root = document.getElementById('tabContent');
  const container = getContainer(containerId);
  if (!root || !container) return;
  const shelter = shelterFor(containerId);
  if (!shelter) {
    root.innerHTML = `<div class="section-head"><h2>Konteyner #${containerId} · Sığınak</h2><button class="btn btn-ghost" data-action="exitShelter" data-container="${containerId}">← Üretime Dön</button></div><div class="container-card"><h3>Bu konteynerin sığınağı henüz açılmadı.</h3><p class="hint">Her konteynerin altında yalnızca bir sığınak açabilirsin.</p><button class="btn btn-green" data-shelter-action="create" data-container="${containerId}">Sığınağı Aç · ₺${SHELTER_COST.toLocaleString('tr-TR')}</button></div>`;
    return;
  }
  ensureShelterLayout(shelter);
  const inventory = economy().mehmetInventory, installed = shelter.installed, fans = installed.fan, racks = shelter.racks;
  const materialRow = (key, blocked = false) => {
    const item = ITEMS[key], owned = Number(inventory[key]) || 0;
    return `<div class="shelter-material-row"><span>${item.icon} <b>${item.name}</b><small>Yerleştirilen: ${Number(installed[key]) || 0} · Depoda: ${owned}</small></span><button class="btn btn-green" data-shelter-action="place" data-container="${containerId}" data-item="${key}" ${owned > 0 && !blocked ? '' : 'disabled'}>Yerleştir</button></div>`;
  };
  const rackHtml = racks.map((rack, ri) => `<article class="container-card shelter-rack"><h3>🗄️ Yetiştirme Rafı #${ri + 1}</h3><div class="shelter-slots">${rack.slots.map((amount, si) => `<div class="shelter-slot"><b>Slot ${si + 1}</b><strong>🌱 ${amount}/2 Özel Botanik Birimi</strong><small>${fans > 0 ? (amount ? 'Havalandırma aktif · Büyüme başlayabilir' : 'Birim bekleniyor') : '🌀 Havalandırma ünitesi gerekli'}</small><button class="btn btn-green" data-shelter-action="place-botanical" data-container="${containerId}" data-rack="${ri}" data-slot="${si}" ${Number(inventory.botanical) > 0 && amount < 2 ? '' : 'disabled'}>Botanik Birimi Yerleştir</button></div>`).join('')}</div></article>`).join('');
  root.innerHTML = `<div class="section-head"><h2>Konteyner #${containerId} · Sığınak</h2><button class="btn btn-ghost" data-action="exitShelter" data-container="${containerId}">← Üretime Dön</button></div><div class="container-card shelter-goto"><h3>Mehmet Reis</h3><p class="hint">Siparişleri tamamladıkça Mehmet Reis'in malzeme kataloğu açılır. Malzemeleri parayla satın alabilirsin.</p><button class="btn btn-green" data-shelter-action="visit-mehmet" data-container="${containerId}">Mehmet Reis'e Git →</button></div><div class="container-card shelter-materials"><h3>Sığınak Ekipmanları</h3>${materialRow('rack', racks.length >= 8)}${materialRow('fan')}${materialRow('workbench', installed.workbench >= 1)}<p class="hint">Raf sınırı: ${racks.length}/8 · Havalandırma: ${fans} · Hazırlık tezgâhı: ${installed.workbench}/1</p>${fans === 0 ? '<p class="shelter-warning">⚠️ En az 1 havalandırma ünitesi yerleştirilmeden botanik birimlerinde büyüme başlamaz.</p>' : '<p class="shelter-ready">✓ Havalandırma aktif. Botanik birimleri büyümeye başlayabilir.</p>'}</div><div class="container-card shelter-materials"><h3>Yetiştirme Rafları · ${racks.length}/8</h3>${racks.length ? rackHtml : '<p class="hint">Henüz raf yerleştirmedin. Her raf 2 slot açar; her slota 2 Özel Botanik Birimi koyabilirsin.</p>'}</div>`;
}
function renderMehmetPage(containerId) {
  const root = document.getElementById('tabContent');
  if (!root) return;
  const e = economy();
  const orderIndex = Math.min(ORDERS.length, e.mehmetOrderIndex);
  const currentOrder = ORDERS[orderIndex];
  const orderHtml = currentOrder ? (() => {
    const available = Number(state.stock?.[currentOrder.type]) || 0;
    const completed = orderIndex;
    return `
      <article class="container-card shelter-order">
        <span class="lvl">Sipariş ${completed + 1}/${ORDERS.length}</span>
        <h3>${currentOrder.name}</h3>
        <p><b>${currentOrder.kg} kg</b> ${currentOrder.mushroom} teslim etmen gerekiyor.</p>
        <p class="hint">Depoda: ${available.toFixed(1)} / ${currentOrder.kg} kg</p>
        <div class="eb-actions">
          <button class="btn btn-green" data-shelter-action="complete-order" data-container="${containerId}" ${available < currentOrder.kg ? 'disabled' : ''}>Depodan Teslim Et</button>
          <button class="btn btn-ghost" data-shelter-action="bypass-order" data-container="${containerId}">Bypass</button>
        </div>
      </article>`;
  })() : '<div class="container-card"><h3>Mehmet Reis: Şimdilik başka siparişim yok.</h3><p class="hint">Bütün mevcut siparişleri tamamladın.</p></div>';


  root.innerHTML = `
    <div class="section-head">
      <h2>Mehmet Reis · Siparişler</h2>
      <button class="btn btn-ghost" data-action="exitShelter" data-container="${containerId}">← Üretime Dön</button>
    </div>
    <p class="hint">Siparişler tüm konteynerlerin için ortaktır. Bir kez tamamlaman yeterli.</p>
    ${orderHtml}
    <div class="container-card shelter-materials">
      <h3>Mehmet Reis'in Malzeme Kataloğu</h3>
      ${Object.entries(ITEMS).map(([key, item]) => {
        const unlocked = e.mehmetOrderIndex >= item.unlockOrder;
        const owned = Number(e.mehmetInventory[key]) || 0;
        return `<div class="shelter-material-row">
          <span>${item.icon} <b>${item.name}</b><small>Depoda: ${owned} · Birim fiyat: ₺${item.price.toLocaleString('tr-TR')}</small></span>
          <button class="btn btn-green" data-shelter-action="buy-material" data-container="${containerId}" data-item="${key}" ${!unlocked || state.money < item.price ? 'disabled' : ''}>${unlocked ? 'Satın Al' : 'Siparişle Açılacak'}</button>
        </div>`;
      }).join('')}
    </div>`;
}

function createShelter(containerId) {
  if (!getContainer(containerId) || shelterFor(containerId)) return;
  if (state.money < SHELTER_COST) {
    alert('Sığınak açmak için ₺280.000 gerekiyor.');
    return;
  }
  state.money -= SHELTER_COST;
  const shelter = {
    containerId: Number(containerId),
    installed: {},
    openedAtDay: state.day
  };
  // Tek kaynak: konteynerin kendi Firebase oyun kaydındaki sığınak alanı.
  const container = getContainer(containerId);
  container.shelter = shelter;
  economy().shelters[String(containerId)] = shelter;
  save();
  renderShelterPage(containerId);
}

function completeOrder(containerId, bypass = false) {
  const e = economy();
  const order = ORDERS[e.mehmetOrderIndex];
  if (!order) return;
  const available = Number(state.stock?.[order.type]) || 0;
  if (!bypass && available < order.kg) {
    alert('Depoda bu sipariş için yeterli türde mantar yok.');
    return;
  }

  if (!bypass) {
    state.stock[order.type] = Math.max(0, available - order.kg);
    state.inventory.mushroom = Math.max(0, (Number(state.inventory.mushroom) || 0) - order.kg);
  }
  e.mehmetOrderIndex += 1;
  save();
  renderMehmetPage(containerId);
}

function buyMaterial(containerId, itemKey) {
  const item = ITEMS[itemKey];
  if (!item) return;
  const e = economy();
  if (e.mehmetOrderIndex < item.unlockOrder) {
    alert('Bu malzeme için önce gerekli siparişi tamamlamalısın.');
    return;
  }
  if (state.money < item.price) {
    alert('Bu malzemeyi almak için paran yetersiz.');
    return;
  }
  state.money -= item.price;
  e.mehmetInventory[itemKey] = (Number(e.mehmetInventory[itemKey]) || 0) + 1;
  save();
  renderMehmetPage(containerId);
}

function placeMaterial(containerId, itemKey) {
  const shelter = shelterFor(containerId);
  if (!shelter || !ITEMS[itemKey]) return;
  ensureShelterLayout(shelter);
  const e = economy(), available = Number(e.mehmetInventory[itemKey]) || 0;
  if (available < 1) { alert('Depoda bu malzemeden yok. Önce Mehmet Reis ile konuş.'); return; }
  if (itemKey === 'rack' && shelter.racks.length >= 8) { alert('Bir sığınağa en fazla 8 yetiştirme rafı yerleştirebilirsin.'); return; }
  if (itemKey === 'workbench' && shelter.installed.workbench >= 1) { alert('Bir sığınağa yalnızca 1 hazırlık tezgâhı yerleştirilebilir.'); return; }
  e.mehmetInventory[itemKey] = available - 1;
  if (itemKey === 'rack') { shelter.racks.push({ id: shelter.racks.length + 1, slots: [0, 0] }); shelter.installed.rack = shelter.racks.length; }
  else shelter.installed[itemKey] = (Number(shelter.installed[itemKey]) || 0) + 1;
  save(); renderShelterPage(containerId);
}

function placeBotanical(containerId, rackIndex, slotIndex) {
  const shelter = shelterFor(containerId);
  if (!shelter) return;
  ensureShelterLayout(shelter);
  const rack = shelter.racks[Number(rackIndex)], slot = Number(slotIndex);
  if (!rack || ![0, 1].includes(slot)) return;
  const e = economy();
  if ((Number(e.mehmetInventory.botanical) || 0) < 1) { alert('Depoda Özel Botanik Birimi yok. Önce Mehmet Reis ile konuş.'); return; }
  if (rack.slots[slot] >= 2) { alert('Bu slotta en fazla 2 Özel Botanik Birimi bulunabilir.'); return; }
  e.mehmetInventory.botanical -= 1; rack.slots[slot] += 1;
  save(); renderShelterPage(containerId);
}
export function openShelterPage(containerId) {
  renderShelterPage(containerId);
}

export function initEmpireBusiness() {
  if (document.getElementById('shelterPageStyles')) return;
  const style = document.createElement('style');
  style.id = 'shelterPageStyles';
  style.textContent = `
    .shelter-order{margin-top:14px}
    .shelter-order h3{font:800 1rem var(--font-head);margin:8px 0}
    .shelter-order p{font-size:.78rem;line-height:1.55;margin:8px 0}
    .shelter-order .btn{width:100%;min-height:42px;margin-top:12px}
    .shelter-order .eb-actions{display:flex;gap:8px}
    .shelter-order .eb-actions .btn{flex:1}
    .shelter-order .btn:disabled,.shelter-material-row .btn:disabled{opacity:.45;cursor:not-allowed}
    .shelter-goto,.shelter-materials{margin-top:12px}
    .shelter-rack{margin-top:10px}.shelter-slots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}.shelter-slot{display:grid;gap:8px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2,transparent)}.shelter-slot strong{font-size:.8rem}.shelter-slot small,.shelter-warning,.shelter-ready{font-size:.7rem;color:var(--muted)}.shelter-warning{color:#d98b32}.shelter-ready{color:#36a66a}.shelter-slot .btn{width:100%;white-space:normal}
    .shelter-goto .btn{width:100%;margin-top:12px}
    .shelter-material-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 0;border-bottom:1px solid var(--border)}
    .shelter-material-row:last-child{border-bottom:0}
    .shelter-material-row>span{display:grid;gap:4px;font-size:.78rem}
    .shelter-material-row small{font-size:.65rem;color:var(--muted)}
    .shelter-material-row .btn{flex:0 0 auto}
    @media(max-width:420px){.shelter-material-row{align-items:flex-start;flex-direction:column}.shelter-material-row .btn{width:100%}.shelter-slots{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-shelter-action]');
    if (!button) return;
    const containerId = Number(button.dataset.container);
    const action = button.dataset.shelterAction;
    if (action === 'create') createShelter(containerId);
    else if (action === 'visit-mehmet') renderMehmetPage(containerId);
    else if (action === 'complete-order') completeOrder(containerId, false);
    else if (action === 'bypass-order') completeOrder(containerId, true);
    else if (action === 'buy-material') buyMaterial(containerId, button.dataset.item);
    else if (action === 'place') placeMaterial(containerId, button.dataset.item);
    else if (action === 'place-botanical') placeBotanical(containerId, button.dataset.rack, button.dataset.slot);
  });
}
