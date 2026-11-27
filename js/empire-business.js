import { state, save } from './core.js';

const SHELTER_COST = 280000;
const ORDERS = [
  { name: 'İstiridye Mantarı Siparişi', type: 'oyster', mushroom: 'İstiridye Mantarı', kg: 270 },
  { name: 'Kral İstiridye Mantarı Siparişi', type: 'king_oyster', mushroom: 'Kral İstiridye Mantarı', kg: 300 }
];

function economy() {
  if (!state.empire || typeof state.empire !== 'object') state.empire = {};
  if (!state.empire.economy || typeof state.empire.economy !== 'object') state.empire.economy = {};
  const e = state.empire.economy;
  if (!e.shelters || typeof e.shelters !== 'object' || Array.isArray(e.shelters)) e.shelters = {};
  if (!Number.isFinite(Number(e.reputation))) e.reputation = 0;
  return e;
}

function shelterFor(containerId) {
  return economy().shelters[String(containerId)] || null;
}

function renderShelterPage(containerId) {
  const root = document.getElementById('tabContent');
  if (!root) return;
  const container = state.containers.find(item => Number(item.id) === Number(containerId));
  if (!container) return;
  const shelter = shelterFor(containerId);
  const e = economy();

  if (!shelter) {
    root.innerHTML = `
      <div class="section-head">
        <h2>Konteyner #${containerId} · Sığınak</h2>
        <button class="btn btn-ghost" data-action="exitContainer">← Geri</button>
      </div>
      <div class="container-card">
        <h3>Bu konteynerin sığınağı henüz açılmadı.</h3>
        <p class="hint">Her konteynerin altında yalnızca bir sığınak açabilirsin.</p>
        <button class="btn btn-green" data-shelter-action="create" data-container="${containerId}">Sığınağı Aç · ₺${SHELTER_COST.toLocaleString('tr-TR')}</button>
      </div>`;
    return;
  }

  const order = ORDERS[shelter.orderIndex] || null;
  const orderHtml = order ? `
    <article class="container-card shelter-order">
      <h3>${order.name}</h3>
      <p><b>${order.kg} kg</b> ${order.mushroom} teslim edilmesi gerekiyor.</p>
      <p class="hint">Depodaki ${order.mushroom} miktarı: ${(Number(state.stock?.[order.type]) || 0).toFixed(1)} kg</p>
      <div class="eb-actions">
        <button class="btn btn-green" data-shelter-action="deliver" data-container="${containerId}" ${(Number(state.stock?.[order.type]) || 0) < order.kg ? 'disabled' : ''}>Depodan Teslim Et</button>
        <button class="btn btn-ghost" data-shelter-action="bypass" data-container="${containerId}">Bypass</button>
      </div>
    </article>` : '<div class="container-card"><h3>Şimdilik tüm siparişler tamamlandı.</h3></div>';

  root.innerHTML = `
    <div class="section-head">
      <h2>Sığınak · Siparişler</h2>
      <button class="btn btn-ghost" data-action="exitContainer">← Geri</button>
    </div>
    <div class="hint">İtibar: <b>${Math.round(e.reputation)}</b> · Tamamlanan sipariş: <b>${shelter.orderIndex}/${ORDERS.length}</b></div>
    ${orderHtml}`;
}

function createShelter(containerId) {
  const container = state.containers.find(item => Number(item.id) === Number(containerId));
  if (!container || shelterFor(containerId)) return;
  if (state.money < SHELTER_COST) {
    alert('Sığınak açmak için ₺280.000 gerekiyor.');
    return;
  }
  state.money -= SHELTER_COST;
  economy().shelters[String(containerId)] = {
    containerId: Number(containerId),
    orderIndex: 0,
    openedAtDay: state.day
  };
  save();
  renderShelterPage(containerId);
}

function completeOrder(containerId, bypass) {
  const shelter = shelterFor(containerId);
  if (!shelter) return;
  const order = ORDERS[shelter.orderIndex];
  if (!order) return;

  if (!bypass) {
    const available = Number(state.stock?.[order.type]) || 0;
    if (available < order.kg) {
      alert('Depoda bu sipariş için yeterli türde mantar yok.');
      return;
    }
    state.stock[order.type] = Math.max(0, available - order.kg);
    state.inventory.mushroom = Math.max(0, (Number(state.inventory.mushroom) || 0) - order.kg);
  }

  shelter.orderIndex += 1;
  economy().reputation += 10;
  save();
  renderShelterPage(containerId);
}

export function openShelterPage(containerId) {
  renderShelterPage(containerId);
}

export function initEmpireBusiness() {
  if (document.getElementById('shelterPageStyles')) return;
  const style = document.createElement('style');
  style.id = 'shelterPageStyles';
  style.textContent = '.shelter-order{margin-top:14px}.shelter-order h3{font:800 1rem var(--font-head);margin-bottom:10px}.shelter-order p{font-size:.78rem;line-height:1.55;margin:8px 0}.shelter-order .eb-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.shelter-order .btn{flex:1;min-height:42px}.shelter-order .btn:disabled{opacity:.45;cursor:not-allowed}';
  document.head.appendChild(style);

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-shelter-action]');
    if (!button) return;
    const containerId = Number(button.dataset.container);
    const action = button.dataset.shelterAction;
    if (action === 'create') createShelter(containerId);
    else if (action === 'deliver') completeOrder(containerId, false);
    else if (action === 'bypass') completeOrder(containerId, true);
  });
}
