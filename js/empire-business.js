import { state, save } from './core.js';

const SHELTER_COST = 280000;
let activeShelterPageId = null;
let activeShelterSubpage = 'shelter';
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
  if (!e.mehmetCart || typeof e.mehmetCart !== 'object') e.mehmetCart = {};
  if (!Number.isFinite(Number(e.sihirliYaprakKg))) e.sihirliYaprakKg=0;
  if (!Number.isFinite(Number(e.sihirliTozKg))) e.sihirliTozKg=0;
  if (typeof e.mehmetSampleDelivered !== 'boolean') e.mehmetSampleDelivered=false;
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
  shelter.racks.forEach((rack,i)=>{rack.id=rack.id||i+1;if(!Array.isArray(rack.slots))rack.slots=[0,0];rack.slots=[0,1].map(n=>Math.min(2,Math.max(0,Number(rack.slots[n])||0)));if(!Array.isArray(rack.units))rack.units=[[],[]];for(let si=0;si<2;si++){while(rack.units[si].length<rack.slots[si])rack.units[si].push({nextHarvestDay:null});rack.units[si]=rack.units[si].slice(0,rack.slots[si]);}});
  shelter.installed.rack = shelter.racks.length;
  shelter.installed.fan = Math.max(0, Number(shelter.installed.fan) || 0);
  shelter.installed.workbench = Math.min(1, Math.max(0, Number(shelter.installed.workbench) || 0));
  return shelter;
}

function renderShelterPage(containerId) {
  activeShelterPageId = Number(containerId);
  activeShelterSubpage = 'shelter';
  const root = document.getElementById('tabContent');
  const container = getContainer(containerId);
  if (!root || !container) return;
  const shelter = shelterFor(containerId);
  if (!shelter) {
    root.innerHTML = `<div class="section-head"><h2>Konteyner #${containerId} · Sığınak</h2><button class="btn btn-ghost" data-action="exitShelter" data-container="${containerId}">← Üretime Dön</button></div><div class="container-card"><h3>Bu konteynerin sığınağı henüz açılmadı.</h3><p class="hint">Her konteynerin altında yalnızca bir sığınak açabilirsin.</p><button class="btn btn-green" data-shelter-action="create" data-container="${containerId}">Sığınağı Aç · ₺${SHELTER_COST.toLocaleString('tr-TR')}</button></div>`;
    return;
  }
  ensureShelterLayout(shelter);
  const e=economy(), inventory=e.mehmetInventory, installed=shelter.installed, fans=installed.fan, racks=shelter.racks;
  const materialRow = (key, blocked = false) => {
    const item = ITEMS[key], owned = Number(inventory[key]) || 0;
    return `<div class="shelter-material-row"><span>${item.icon} <b>${item.name}</b><small>Yerleştirilen: ${Number(installed[key]) || 0} · Depoda: ${owned}</small></span><button class="btn btn-green" data-shelter-action="place" data-container="${containerId}" data-item="${key}" ${owned > 0 && !blocked ? '' : 'disabled'}>Yerleştir</button></div>`;
  };
  const rackHtml=racks.map((rack,ri)=>`<article class="container-card shelter-rack"><h3>🗄️ Yetiştirme Rafı #${ri+1}</h3><div class="shelter-slots">${rack.slots.map((amount,si)=>{const ready=rack.units[si].filter(u=>u.nextHarvestTick!=null&&state.tickCount>=u.nextHarvestTick).length;const growingUnits=rack.units[si].filter(u=>u.nextHarvestTick!=null&&state.tickCount<u.nextHarvestTick);const growing=growingUnits.length;const ticksLeft=growing?Math.min(...growingUnits.map(u=>u.nextHarvestTick-state.tickCount)):0;const daysLeft=growing?Math.ceil(ticksLeft/12):0;const progress=growing?Math.max(0,Math.min(100,((84-ticksLeft)/84)*100)):ready?100:0;return `<div class="shelter-slot"><b>Slot ${si+1}</b><strong>🌱 ${amount}/2 Özel Botanik Birimi</strong><small>${fans===0?'Havalandırma gerekli':ready?`HASADA HAZIR: ${ready} · ${(ready*.1).toFixed(1)} kg yaprak${growing?` · Diğer ${growing} birim: ${daysLeft} oyun günü`:''}`:growing?`${growing} birim büyüyor · HASADA ${daysLeft} OYUN GÜNÜ KALDI`:'Birim bekleniyor'}</small><div class="botanical-progress"><i style="width:${progress}%"></i></div><button class="btn btn-green" data-shelter-action="harvest" data-container="${containerId}" data-rack="${ri}" data-slot="${si}" ${ready?'':'disabled'}>Hasat Et</button><button class="btn btn-ghost" data-shelter-action="place-botanical" data-container="${containerId}" data-rack="${ri}" data-slot="${si}" ${Number(inventory.botanical)>0&&amount<2?'':'disabled'}>Botanik Birimi Yerleştir</button></div>`;}).join('')}</div></article>`).join('');
  const prep=installed.workbench>0?`<div class="container-card shelter-materials"><h3>🛠️ Hazırlık Masası</h3><p>Sihirli Yaprak: ${Number(e.sihirliYaprakKg).toFixed(2)} kg · Sihirli Toz: ${Number(e.sihirliTozKg).toFixed(2)} kg</p><p class="hint">1 kg yaprak = 0,4 kg toz.</p><input id="magicLeafAmount" type="number" min="0.01" step="0.01" value="0.25" max="${Number(e.sihirliYaprakKg).toFixed(2)}"><button class="btn btn-green" data-shelter-action="process-leaves" data-container="${containerId}" ${Number(e.sihirliYaprakKg)>=.01?'':'disabled'}>Sihirli Toz Hazırla</button></div>`:'';
  const tuco=e.mehmetSampleDelivered?`<div class="container-card shelter-goto"><h3>Tuco Salamanca</h3><button class="btn btn-green" data-shelter-action="visit-tuco" data-container="${containerId}">Tuco'ya Git →</button></div>`:'';
  root.innerHTML=`<div class="section-head"><h2>Konteyner #${containerId} · Sığınak</h2><button class="btn btn-ghost" data-action="exitShelter" data-container="${containerId}">← Üretime Dön</button></div><div class="container-card shelter-goto"><h3>Mehmet Reis</h3><p class="hint">Siparişleri tamamladıkça Mehmet Reis'in malzeme kataloğu açılır.</p><button class="btn btn-green" data-shelter-action="visit-mehmet" data-container="${containerId}">Mehmet Reis'e Git →</button></div>${tuco}${prep}<div class="container-card shelter-materials"><h3>Sığınak Ekipmanları</h3>${materialRow('rack',racks.length>=8)}${materialRow('fan')}${materialRow('workbench',installed.workbench>=1)}<p class="hint">Raf: ${racks.length}/8 · Havalandırma: ${fans} · Hazırlık tezgâhı: ${installed.workbench}/1</p>${fans===0?'<p class="shelter-warning">Havalandırma olmadan büyüme başlamaz.</p>':'<p class="shelter-ready">Havalandırma aktif.</p>'}</div><div class="container-card shelter-materials"><h3>Yetiştirme Rafları · ${racks.length}/8</h3>${racks.length?rackHtml:'<p class="hint">Henüz raf yerleştirmedin.</p>'}<button class="btn btn-green shelter-fill-all" data-shelter-action="fill-all" data-container="${containerId}" ${racks.length===0||Number(inventory.botanical)<1?'disabled':''}>Tüm Slotları Doldur</button></div>`;
}
function renderMehmetPage(containerId) {
  activeShelterPageId = Number(containerId);
  activeShelterSubpage = 'mehmet';
  const root = document.getElementById('tabContent');
  if (!root) return;
  const e = economy();
  const orderIndex = Math.min(ORDERS.length, e.mehmetOrderIndex);
  const currentOrder = ORDERS[orderIndex];
  const orderHtml = currentOrder ? (() => {
    const available = Number(state.stock?.[currentOrder.type]) || 0;
    return `<article class="container-card shelter-order"><span class="lvl">Sipariş ${orderIndex + 1}/${ORDERS.length}</span><h3>${currentOrder.name}</h3><p><b>${currentOrder.kg} kg</b> ${currentOrder.mushroom} teslim etmen gerekiyor.</p><p class="hint">Depoda: ${available.toFixed(1)} / ${currentOrder.kg} kg</p><div class="eb-actions"><button class="btn btn-green" data-shelter-action="complete-order" data-container="${containerId}" ${available < currentOrder.kg ? 'disabled' : ''}>Depodan Teslim Et</button><button class="btn btn-ghost" data-shelter-action="bypass-order" data-container="${containerId}">Bypass</button></div></article>`;
  })() : '<div class="container-card"><h3>Mehmet Reis: Şimdilik başka siparişim yok.</h3><p class="hint">Bütün mevcut siparişleri tamamladın.</p></div>';
  const sampleHtml=!e.mehmetSampleDelivered?`<article class="container-card shelter-order"><h3>Numune Talebi</h3><p>Mehmet Reis 0,1 kg Sihirli Toz istiyor.</p><p class="hint">Stok: ${Number(e.sihirliTozKg).toFixed(2)} kg</p><button class="btn btn-green" data-shelter-action="deliver-sample" data-container="${containerId}" ${Number(e.sihirliTozKg)>=.1?'':'disabled'}>0,1 kg Numuneyi Teslim Et</button></article>`:`<article class="container-card shelter-order"><h3>Numune teslim edildi!</h3><p>Mehmet Reis seni Tuco Salamanca ile tanıştırdı.</p></article>`;
  const cartEntries = Object.entries(e.mehmetCart).filter(([key, qty]) => ITEMS[key] && Number(qty) > 0);
  const cartTotal = cartEntries.reduce((sum, [key, qty]) => sum + ITEMS[key].price * Number(qty), 0);
  const cartHtml = cartEntries.length ? cartEntries.map(([key, qty]) => `<div class="shelter-material-row"><span><b>${ITEMS[key].icon} ${ITEMS[key].name}</b><small>${qty} adet × ₺${ITEMS[key].price.toLocaleString('tr-TR')} = ₺${(Number(qty) * ITEMS[key].price).toLocaleString('tr-TR')}</small></span><button class="btn btn-ghost" data-shelter-action="remove-cart" data-item="${key}">Kaldır</button></div>`).join('') : '<p class="hint">Sepetin boş.</p>';
  root.innerHTML = `<div class="section-head"><h2>Mehmet Reis · Siparişler</h2><button class="btn btn-ghost" data-action="exitShelter" data-container="${containerId}">← Üretime Dön</button></div><p class="hint">Siparişler tüm konteynerlerin için ortaktır. Bir kez tamamlaman yeterli.</p>${orderHtml}${sampleHtml}<div class="container-card shelter-materials"><h3>Mehmet Reis'in Malzeme Kataloğu</h3>${Object.entries(ITEMS).map(([key,item]) => { const unlocked = e.mehmetOrderIndex >= item.unlockOrder; const owned = Number(e.mehmetInventory[key]) || 0; return `<div class="shelter-material-row"><span>${item.icon} <b>${item.name}</b><small>Depoda: ${owned} · Birim fiyat: ₺${item.price.toLocaleString('tr-TR')}</small></span><div class="shelter-buy-controls"><input class="shelter-qty" type="number" min="1" step="1" value="1" data-cart-qty="${key}" aria-label="${item.name} adedi"><button class="btn btn-green" data-shelter-action="add-cart" data-item="${key}" ${!unlocked ? 'disabled' : ''}>Sepete Ekle</button></div></div>`; }).join('')}</div><div class="container-card shelter-materials"><h3>🛒 Alışveriş Sepeti</h3>${cartHtml}<div class="shelter-cart-total">Toplam: ₺${cartTotal.toLocaleString('tr-TR')}</div><button class="btn btn-green shelter-checkout" data-shelter-action="checkout" data-container="${containerId}" ${!cartEntries.length || state.money < cartTotal ? 'disabled' : ''}>Sepeti Satın Al</button><p class="hint">Mevcut paran: ₺${Number(state.money).toLocaleString('tr-TR')}</p></div>`;
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

function addToMehmetCart(itemKey) {
  const item = ITEMS[itemKey]; if (!item) return;
  const input = document.querySelector(`[data-cart-qty="${itemKey}"]`);
  const qty = Math.floor(Number(input?.value));
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > 1000000) { alert('1 ile 1.000.000 arasında geçerli bir adet gir.'); return; }
  const e = economy();
  if (e.mehmetOrderIndex < item.unlockOrder) { alert('Bu malzeme için önce gerekli siparişi tamamlamalısın.'); return; }
  e.mehmetCart[itemKey] = Math.min(1000000, (Number(e.mehmetCart[itemKey]) || 0) + qty);
  save();
  const containerId = Number(document.querySelector('[data-shelter-action="checkout"]')?.dataset.container || document.querySelector('[data-shelter-action="add-cart"]')?.dataset.container || 0);
  if (containerId) renderMehmetPage(containerId);
}
function removeFromMehmetCart(itemKey, containerId) {
  delete economy().mehmetCart[itemKey]; save(); renderMehmetPage(containerId);
}
function checkoutMehmetCart(containerId) {
  const e = economy(), entries = Object.entries(e.mehmetCart).filter(([key, qty]) => ITEMS[key] && Number(qty) > 0);
  if (!entries.length) return;
  let total = 0;
  for (const [key, rawQty] of entries) { const qty = Math.floor(Number(rawQty)); if (!Number.isSafeInteger(qty) || qty < 1 || e.mehmetOrderIndex < ITEMS[key].unlockOrder) { alert('Sepette geçersiz veya kilitli bir ürün var.'); return; } total += qty * ITEMS[key].price; }
  if (!Number.isSafeInteger(total) || state.money < total) { alert('Sepet toplamı için paran yetersiz.'); return; }
  state.money -= total;
  entries.forEach(([key, qty]) => { e.mehmetInventory[key] = (Number(e.mehmetInventory[key]) || 0) + Number(qty); });
  e.mehmetCart = {}; save(); renderMehmetPage(containerId);
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
  if (itemKey === 'rack') { shelter.racks.push({ id: shelter.racks.length + 1, slots: [0, 0], units:[[],[]] }); shelter.installed.rack = shelter.racks.length; }
  else { shelter.installed[itemKey]=(Number(shelter.installed[itemKey])||0)+1; if(itemKey==='fan')shelter.racks.forEach(r=>r.units?.forEach(slot=>slot.forEach(u=>{if(u.nextHarvestTick==null){const remaining=u.nextHarvestDay==null?7:Math.max(0,Number(u.nextHarvestDay)-state.day);u.nextHarvestTick=state.tickCount+remaining*12;}}))); }
  save(); renderShelterPage(containerId);
}

function fillAllBotanicalSlots(id){const s=shelterFor(id);if(!s)return;ensureShelterLayout(s);const e=economy();let left=Math.max(0,Math.floor(Number(e.mehmetInventory.botanical)||0)),placed=0;for(const r of s.racks)for(let i=0;i<2&&left>0;i++){const n=Math.min(2-r.slots[i],left);for(let j=0;j<n;j++)r.units[i].push({nextHarvestDay:s.installed.fan>0?state.day+7:null,nextHarvestTick:s.installed.fan>0?state.tickCount+84:null});r.slots[i]+=n;left-=n;placed+=n;}if(!placed){alert('Boş slot yok veya botanik birimi yok.');return;}e.mehmetInventory.botanical-=placed;save();renderShelterPage(id);}
function placeBotanical(containerId, rackIndex, slotIndex) {
  const shelter = shelterFor(containerId);
  if (!shelter) return;
  ensureShelterLayout(shelter);
  const rack = shelter.racks[Number(rackIndex)], slot = Number(slotIndex);
  if (!rack || ![0, 1].includes(slot)) return;
  const e = economy();
  if ((Number(e.mehmetInventory.botanical) || 0) < 1) { alert('Depoda Özel Botanik Birimi yok. Önce Mehmet Reis ile konuş.'); return; }
  if (rack.slots[slot] >= 2) { alert('Bu slotta en fazla 2 Özel Botanik Birimi bulunabilir.'); return; }
  e.mehmetInventory.botanical -= 1; rack.slots[slot] += 1; rack.units[slot].push({nextHarvestDay:shelter.installed.fan>0?state.day+7:null,nextHarvestTick:shelter.installed.fan>0?state.tickCount+84:null});
  save(); renderShelterPage(containerId);
}
function processMagicLeaves(id){const s=shelterFor(id),e=economy();if(!s||s.installed.workbench<1)return;const kg=Math.round(Number(document.getElementById('magicLeafAmount')?.value)*100)/100;if(!Number.isFinite(kg)||kg<=0||kg>Number(e.sihirliYaprakKg)+1e-9){alert('Geçerli yaprak miktarı gir.');return;}e.sihirliYaprakKg=+(Number(e.sihirliYaprakKg)-kg).toFixed(2);e.sihirliTozKg=+(Number(e.sihirliTozKg)+kg*.4).toFixed(3);save();renderShelterPage(id);}
function deliverSample(id){const e=economy();if(e.mehmetSampleDelivered||Number(e.sihirliTozKg)<.1)return;e.sihirliTozKg=+(Number(e.sihirliTozKg)-.1).toFixed(3);e.mehmetSampleDelivered=true;save();renderMehmetPage(id);}
function visitTuco(id){const e=economy(),root=document.getElementById('tabContent');if(!root)return;activeShelterPageId=Number(id);activeShelterSubpage='tuco';if(!e.mehmetSampleDelivered){renderMehmetPage(id);return;}root.innerHTML='<div class="section-head"><h2>Tuco Salamanca</h2><button class="btn btn-ghost" data-action="exitShelter" data-container="'+id+'">← Sığınağa Dön</button></div><div class="container-card"><h3>Tuco</h3><p>Mehmet Reis seni bana gönderdi.</p><p>Satışa hazır Sihirli Toz: <b>'+Number(e.sihirliTozKg).toFixed(2)+' kg</b></p><p class="hint">Satış fiyatı belirlendiğinde satış işlemini burada etkinleştireceğiz.</p></div>';}
export function advanceShelterGrowth(){
  let changed=false;
  for(const container of state.containers||[]){
    const shelter=shelterFor(container.id);
    if(!shelter)continue;
    ensureShelterLayout(shelter);
    if(shelter.installed.fan<1)continue;
    for(const rack of shelter.racks)for(const slot of rack.units)for(const unit of slot){
      if(!Number.isFinite(Number(unit.nextHarvestTick))){
        const remaining=unit.nextHarvestDay==null?7:Math.max(0,Number(unit.nextHarvestDay)-Number(state.day||0));
        unit.nextHarvestTick=Number(state.tickCount||0)+remaining*12;
        changed=true;
      }
    }
  }
  if(changed)save();
  if(activeShelterPageId!=null&&activeShelterSubpage==='shelter')renderShelterPage(activeShelterPageId);
}
export function handleShelterBack(){
  if(activeShelterPageId==null)return false;
  if(activeShelterSubpage==='mehmet'||activeShelterSubpage==='tuco'){
    renderShelterPage(activeShelterPageId);
    return true;
  }
  activeShelterPageId=null;
  return false;
}
export function leaveShelterPage(){activeShelterPageId=null;activeShelterSubpage='shelter';}

function harvestBotanicals(id,ri,si){const s=shelterFor(id);if(!s)return;ensureShelterLayout(s);const r=s.racks[Number(ri)],slot=Number(si);if(!r||![0,1].includes(slot))return;const ready=r.units[slot].filter(u=>u.nextHarvestTick!=null&&state.tickCount>=u.nextHarvestTick);if(!ready.length)return;const e=economy();e.sihirliYaprakKg=+(Number(e.sihirliYaprakKg)+ready.length*.1).toFixed(2);ready.forEach(u=>{u.nextHarvestDay=state.day+7;u.nextHarvestTick=state.tickCount+84;});save();renderShelterPage(id);}
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
    .botanical-progress{height:6px;border-radius:99px;background:var(--border);overflow:hidden}.botanical-progress i{display:block;height:100%;background:#36a66a;transition:width .2s}.shelter-rack{margin-top:10px}.shelter-slots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}.shelter-slot{display:grid;gap:8px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2,transparent)}.shelter-slot strong{font-size:.8rem}.shelter-slot small,.shelter-warning,.shelter-ready{font-size:.7rem;color:var(--muted)}.shelter-warning{color:#d98b32}.shelter-ready{color:#36a66a}.shelter-slot .btn{width:100%;white-space:normal}
    .shelter-goto .btn{width:100%;margin-top:12px}
    .shelter-buy-controls{display:flex;gap:6px;align-items:center}.shelter-qty{width:76px;min-width:0;padding:9px;background:#090c08;border:1px solid var(--border);color:var(--text);border-radius:6px}.shelter-cart-total{font-weight:800;text-align:right;padding:12px 0}.shelter-checkout,.shelter-fill-all{width:100%;margin-top:10px}
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
    else if (action === 'visit-tuco') visitTuco(containerId);
    else if (action === 'process-leaves') processMagicLeaves(containerId);
    else if (action === 'deliver-sample') deliverSample(containerId);
    else if (action === 'harvest') harvestBotanicals(containerId,button.dataset.rack,button.dataset.slot);
    else if (action === 'complete-order') completeOrder(containerId, false);
    else if (action === 'bypass-order') completeOrder(containerId, true);
    else if (action === 'buy-material') buyMaterial(containerId, button.dataset.item);
    else if (action === 'add-cart') addToMehmetCart(button.dataset.item, containerId);
    else if (action === 'remove-cart') removeFromMehmetCart(button.dataset.item, containerId);
    else if (action === 'checkout') checkoutMehmetCart(containerId);
    else if (action === 'fill-all') fillAllBotanicalSlots(containerId);
    else if (action === 'place') placeMaterial(containerId, button.dataset.item);
    else if (action === 'place-botanical') placeBotanical(containerId, button.dataset.rack, button.dataset.slot);
  });
}
