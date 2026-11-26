import { state, save } from './core.js';
import { render as renderGame } from './game.js';

const CATALOG = [
  { id: 'market', name: 'Market', icon: '🛒', price: 850000, income: 18500, upkeep: 4200, capacity: 1.00 },
  { id: 'salon', name: 'Güzellik Salonu', icon: '💇', price: 620000, income: 14800, upkeep: 3100, capacity: 0.92 },
  { id: 'restaurant', name: 'Restoran', icon: '🍽️', price: 1250000, income: 28500, upkeep: 7800, capacity: 1.12 },
  { id: 'carwash', name: 'Oto Yıkama', icon: '🚗', price: 540000, income: 13200, upkeep: 2900, capacity: 0.90 },
  { id: 'clothing', name: 'Giyim Mağazası', icon: '👕', price: 790000, income: 17600, upkeep: 3900, capacity: 0.98 },
  { id: 'hotel', name: 'Otel', icon: '🏨', price: 3200000, income: 68000, upkeep: 24500, capacity: 1.18 },
  { id: 'cafe', name: 'Kafe', icon: '☕', price: 680000, income: 15800, upkeep: 3600, capacity: 0.96 },
  { id: 'barber', name: 'Berber', icon: '💈', price: 390000, income: 9700, upkeep: 1900, capacity: 0.86 },
  { id: 'gym', name: 'Spor Salonu', icon: '🏋️', price: 1450000, income: 31500, upkeep: 9200, capacity: 1.08 }
];

const CITY_FACTOR = {
  İstanbul: 1.28, Ankara: 1.08, İzmir: 1.12, Antalya: 1.16,
  Bursa: 1.03, Adana: 0.96, Kayseri: 0.91, Konya: 0.92
};

const money = value => '₺' + Math.round(Number(value) || 0).toLocaleString('tr-TR');
let mounted = false;

function ensureEconomy() {
  const empire = state.empire;
  if (!empire.economy || typeof empire.economy !== 'object') {
    empire.economy = {
      day: 1, dirtyBalance: 0, suspicion: 0, audits: 0,
      lastAuditDay: 0, frozenUntil: 0, log: [],
      businesses: []
    };
  }
  const e = empire.economy;
  if (!Array.isArray(e.businesses)) e.businesses = [];
  if (!Array.isArray(e.log)) e.log = [];
  ['day','dirtyBalance','suspicion','audits','lastAuditDay','frozenUntil'].forEach(k => {
    if (!Number.isFinite(Number(e[k]))) e[k] = 0;
  });
  if (!e.day) e.day = 1;
  return e;
}

function cityFactor() {
  return CITY_FACTOR[state.empire?.world?.cityName] || 1;
}

function logEvent(message) {
  const e = ensureEconomy();
  e.log.unshift({ day: e.day, message });
  e.log = e.log.slice(0, 12);
}

function buyBusiness(id) {
  const e = ensureEconomy();
  const item = CATALOG.find(x => x.id === id);
  if (!item || e.businesses.some(x => x.type === id)) return;
  const cost = Math.round(item.price * cityFactor());
  if (state.money < cost) { alert('Bu işletme için paran yeterli değil.'); return; }
  state.money -= cost;
  e.businesses.push({
    id: crypto.randomUUID(), type: id, name: item.name,
    level: 1, staff: 0, activity: 1, condition: 100,
    suspicion: 0, frozen: false
  });
  logEvent(item.name + ' satın alındı.');
  save(); renderGame();
}

function advanceEmpireDay() {
  const e = ensureEconomy();
  e.day += 1;
  let net = 0;
  for (const business of e.businesses) {
    const item = CATALOG.find(x => x.id === business.type);
    if (!item || business.frozen || e.frozenUntil >= e.day) continue;
    const levelFactor = 1 + (business.level - 1) * 0.22;
    const staffFactor = Math.min(1.35, 1 + business.staff * 0.07);
    const conditionFactor = Math.max(0.45, business.condition / 100);
    const activityFactor = Math.max(0.5, Math.min(1.5, Number(business.activity) || 1));
    const gross = item.income * cityFactor() * levelFactor * staffFactor * conditionFactor * activityFactor;
    const expense = item.upkeep * levelFactor + business.staff * 650;
    const profit = Math.round(gross - expense);
    state.money += profit;
    net += profit;

    // İşletme performansı ve ekonomik tutarlılık, yalnızca oyun içi soyut risk puanını etkiler.
    const deviation = Math.max(0, activityFactor - item.capacity);
    business.suspicion = Math.min(100, (business.suspicion || 0) + deviation * 0.12 + (business.condition < 30 ? 0.08 : 0));
    business.condition = Math.max(0, business.condition - 0.18);
    e.suspicion = Math.min(100, e.suspicion + deviation * 0.025);
  }
  logEvent('Gün tamamlandı. İşletmelerin net sonucu: ' + money(net) + '.');

  if (e.day % 70 === 0) runAudit(e);
  save(); renderGame();
}

function runAudit(e) {
  e.audits += 1;
  const businessRisk = e.businesses.reduce((sum, b) => sum + (Number(b.suspicion) || 0), 0);
  const score = Math.min(100, e.suspicion * 0.55 + businessRisk * 0.45 / Math.max(1, e.businesses.length));
  const roll = Math.random() * 100;
  e.lastAuditDay = e.day;
  if (score >= 72 || (score >= 48 && roll < 28) || (score >= 25 && roll < 9)) {
    const severity = score >= 72 ? 'ağır' : score >= 48 ? 'orta' : 'hafif';
    const fine = Math.min(Math.max(0, state.money), Math.round(state.money * (score >= 72 ? 0.22 : score >= 48 ? 0.10 : 0.04)));
    state.money -= fine;
    e.frozenUntil = e.day + (score >= 72 ? 18 : score >= 48 ? 9 : 3);
    e.suspicion = Math.min(100, e.suspicion + 8);
    if (score >= 72) e.businesses.forEach(b => { if ((b.suspicion || 0) > 30) b.frozen = true; });
    logEvent('70 günlük polis denetimi: ' + severity + ' soruşturma. ' + money(fine) + ' ceza ve geçici faaliyet durdurma.');
  } else {
    e.suspicion = Math.max(0, e.suspicion - 7);
    e.businesses.forEach(b => { b.suspicion = Math.max(0, (b.suspicion || 0) - 5); });
    logEvent('70 günlük polis denetimi tamamlandı. İşletmeler faaliyetlerine devam ediyor.');
  }
}

function upgradeBusiness(id) {
  const e = ensureEconomy();
  const b = e.businesses.find(x => x.id === id);
  if (!b) return;
  const cost = Math.round(CATALOG.find(x => x.id === b.type).price * (0.42 + b.level * 0.18));
  if (state.money < cost) { alert('Yükseltme için paran yeterli değil.'); return; }
  state.money -= cost;
  b.level = Math.min(5, b.level + 1);
  logEvent(b.name + ' seviye ' + b.level + ' oldu.');
  save(); renderGame();
}

function hireStaff(id) {
  const e = ensureEconomy();
  const b = e.businesses.find(x => x.id === id);
  if (!b || b.staff >= 8) return;
  const cost = 18000 + b.staff * 9000;
  if (state.money < cost) { alert('Personel işe almak için paran yeterli değil.'); return; }
  state.money -= cost;
  b.staff += 1;
  logEvent(b.name + ' için personel işe alındı.');
  save(); renderGame();
}

function repairBusiness(id) {
  const e = ensureEconomy();
  const b = e.businesses.find(x => x.id === id);
  if (!b || b.condition >= 99) return;
  const cost = Math.round((100 - b.condition) * 850);
  if (state.money < cost) { alert('Bakım için paran yeterli değil.'); return; }
  state.money -= cost;
  b.condition = 100;
  save(); renderGame();
}

function renderBusinessPanel() {
  const home = document.querySelector('.empire-home');
  if (!home || home.querySelector('.empire-business-panel')) return;
  const e = ensureEconomy();
  const owned = new Set(e.businesses.map(b => b.type));
  const catalog = CATALOG.filter(item => !owned.has(item.id)).map(item => {
    const price = Math.round(item.price * cityFactor());
    return '<article class="eb-card"><div class="eb-title"><span>' + item.icon + ' ' + item.name + '</span><b>' + money(price) + '</b></div><p>Günlük tahmini ciro: ' + money(item.income * cityFactor()) + '</p><button class="btn btn-green" data-eb="buy" data-id="' + item.id + '">İşletmeyi satın al</button></article>';
  }).join('');
  const businesses = e.businesses.map(b => {
    const item = CATALOG.find(x => x.id === b.type);
    const frozen = b.frozen || e.frozenUntil >= e.day;
    return '<article class="eb-card"><div class="eb-title"><span>' + item.icon + ' ' + b.name + '</span><b>Sv. ' + b.level + '</b></div>' +
      '<p>Çalışan: ' + b.staff + ' · Durum: %' + Math.round(b.condition) + ' · Şüphe: %' + Math.round(b.suspicion || 0) + '</p>' +
      '<p>' + (frozen ? '⛔ Geçici olarak kapalı' : '🟢 Faaliyette') + '</p>' +
      '<div class="eb-actions"><button class="btn btn-ghost" data-eb="upgrade" data-id="' + b.id + '">Geliştir</button><button class="btn btn-ghost" data-eb="staff" data-id="' + b.id + '">Personel al</button><button class="btn btn-ghost" data-eb="repair" data-id="' + b.id + '">Bakım yap</button></div></article>';
  }).join('');
  const panel = document.createElement('section');
  panel.className = 'empire-business-panel';
  panel.innerHTML = '<div class="eb-heading"><h2>Şehir İşletmeleri</h2><span>Oyun günü ' + e.day + '</span></div>' +
    '<div class="eb-summary"><div><small>Normal bakiye</small><b>' + money(state.money) + '</b></div><div><small>Gizli bakiye</small><b>' + money(e.dirtyBalance) + '</b></div><div><small>Genel şüphe</small><b>%' + Math.round(e.suspicion) + '</b></div><div><small>Son denetim</small><b>' + (e.lastAuditDay || 'Yok') + '</b></div></div>' +
    '<button class="btn btn-green eb-day" data-eb="day">+ 1 Oyun Günü İlerle</button>' +
    '<h3>Satın Alınabilir İşletmeler</h3><div class="eb-grid">' + (catalog || '<p class="eb-muted">Bu katalogdaki tüm işletmelere sahipsin.</p>') + '</div>' +
    '<h3>Sahip Olduğun İşletmeler</h3><div class="eb-grid">' + (businesses || '<p class="eb-muted">Henüz işletmen yok. İlk işletmeni satın alabilirsin.</p>') + '</div>' +
    '<h3>Şehir Denetim Kaydı</h3><div class="eb-log">' + (e.log.length ? e.log.map(x => '<p><b>Gün ' + x.day + ':</b> ' + x.message + '</p>').join('') : '<p>Henüz kayıt yok.</p>') + '</div>' +
    '<p class="eb-note">Polis denetimi her 70 oyun gününde bir yapılır. Şüphe puanı birikimli ve oyun içi soyut bir risk göstergesidir.</p>';
  home.appendChild(panel);
}

function addStyles() {
  if (document.getElementById('empireBusinessStyles')) return;
  const style = document.createElement('style');
  style.id = 'empireBusinessStyles';
  style.textContent = '.empire-business-panel{margin-top:20px}.eb-heading{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:20px 0 12px}.eb-heading h2{font:800 1.15rem var(--font-head)}.eb-heading span,.eb-muted,.eb-note{color:var(--muted);font-size:.7rem}.eb-summary,.eb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:10px 0 18px}.eb-summary>div,.eb-card,.eb-log{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;min-width:0}.eb-summary small,.eb-summary b{display:block}.eb-summary small{font-size:.62rem;color:var(--muted)}.eb-summary b{font-size:.85rem;margin-top:5px;overflow-wrap:anywhere}.eb-card p{font-size:.68rem;color:var(--muted);margin:8px 0}.eb-title{display:flex;justify-content:space-between;gap:8px;font-size:.78rem;font-weight:700}.eb-title b{color:var(--gold);white-space:nowrap}.eb-card .btn{font-size:.62rem;padding:8px}.eb-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}.eb-day{width:100%;margin:4px 0 18px;min-height:44px}.empire-business-panel h3{font:700 .8rem var(--font-head);margin:18px 0 8px}.eb-log{max-height:220px;overflow:auto}.eb-log p{font-size:.68rem;color:var(--muted);padding:5px 0;border-bottom:1px solid var(--border)}.eb-log p:last-child{border:0}.eb-note{line-height:1.5;margin-top:10px}@media(max-width:520px){.eb-summary,.eb-grid{grid-template-columns:1fr 1fr}.eb-card{padding:10px}.eb-actions .btn{flex:1}}';
  document.head.appendChild(style);
}

export function initEmpireBusiness() {
  if (mounted) return;
  mounted = true;
  addStyles();
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-eb]');
    if (!button) return;
    const action = button.dataset.eb;
    const id = button.dataset.id;
    if (action === 'buy') buyBusiness(id);
    else if (action === 'upgrade') upgradeBusiness(id);
    else if (action === 'staff') hireStaff(id);
    else if (action === 'repair') repairBusiness(id);
    else if (action === 'day') advanceEmpireDay();
  });
  setInterval(() => {
    if (!state.empire?.unlocked || !state.empire.world?.setupComplete) return;
    renderBusinessPanel();
  }, 500);
}
