:root {
  --bg: #0a0c08; --surface: #121610; --surface-2: #1a2018;
  --text: #e6e8df; --muted: #7d8574; --border: #2a3226;
  --green: #6aa84f; --green-bright: #8bc34a; --gold: #e8c56a;
  --danger: #b02525; --danger-bright: #d63a3a;
  --star: #f0c24a;
  --font-head: 'Cinzel', serif; --font-body: 'Inter', sans-serif;
}
* { margin:0; padding:0; box-sizing:border-box; }
html, body { height:100%; }
body {
  background: var(--bg); color: var(--text); font-family: var(--font-body);
  -webkit-font-smoothing: antialiased; overflow: hidden;
  display:flex; flex-direction:column; height:100dvh;
}

/* ===== HUD (ÜST BAR) ===== */
.hud {
  flex-shrink:0; display:flex; align-items:center; gap:6px;
  padding:8px 10px; padding-top:calc(8px + env(safe-area-inset-top));
  border-bottom:1px solid var(--border); background:rgba(18,22,16,0.97); z-index:5;
  overflow-x:auto; -webkit-overflow-scrolling:touch;
}
.stat {
  display:flex; flex-direction:column; padding:3px 8px;
  border-radius:4px; background:var(--surface-2); flex-shrink:0;
}
.stat .lbl { font-size:0.5rem; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); font-weight:600; }
.stat .val { font-family:var(--font-head); font-size:0.85rem; font-weight:700; white-space:nowrap; }
.val.gold { color:var(--gold); }
.val.green { color:var(--green-bright); }
.val.danger { color:var(--danger-bright); }
.hud-spacer { flex:1; min-width:4px; }

.speed-group { display:flex; gap:2px; flex-shrink:0; }
.speed-btn {
  padding:6px 8px; background:var(--surface-2); color:var(--muted);
  border:1px solid var(--border); border-radius:3px; font-family:var(--font-body);
  font-size:0.62rem; font-weight:700; letter-spacing:0.5px; cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}
.speed-btn.active { background:var(--green); color:#0a0c08; border-color:var(--green); }

#resetBtn {
  flex-shrink:0; padding:7px 10px; background:transparent; color:var(--muted);
  border:1px solid var(--border); border-radius:4px; font-family:var(--font-body);
  font-size:0.62rem; letter-spacing:1px; text-transform:uppercase; cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}
#resetBtn:hover { color:var(--danger-bright); border-color:var(--danger); }

/* ===== SEKMELER ===== */
.tabs {
  flex-shrink:0; display:flex; border-bottom:1px solid var(--border);
  background:var(--surface); overflow-x:auto; -webkit-overflow-scrolling:touch;
}
.tab {
  flex:1; min-width:70px; padding:11px 6px; background:transparent;
  color:var(--muted); border:none; border-bottom:2px solid transparent;
  font-family:var(--font-body); font-size:0.64rem; font-weight:600;
  letter-spacing:1px; text-transform:uppercase; cursor:pointer;
  -webkit-tap-highlight-color:transparent; white-space:nowrap;
  transition:color 0.2s, border-color 0.2s;
}
.tab.active { color:var(--green-bright); border-bottom-color:var(--green-bright); }
.tab:hover { color:var(--text); }

/* ===== İÇERİK ALANI ===== */
.content { flex:1; min-height:0; overflow-y:auto; padding:12px 12px 100px; -webkit-overflow-scrolling:touch; }

.section-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; gap:8px; flex-wrap:wrap; }
.section-head h2 { font-family:var(--font-head); font-size:1rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; }

/* ===== BUTONLAR & UYARILAR ===== */
.btn {
  padding:10px 16px; border-radius:4px; border:none; font-family:var(--font-body);
  font-size:0.72rem; font-weight:600; letter-spacing:1px; text-transform:uppercase;
  cursor:pointer; -webkit-tap-highlight-color:transparent; transition:background 0.2s, transform 0.1s;
}
.btn:active { transform:scale(0.97); }
.btn-green { background:var(--green); color:#0a0c08; }
.btn-green:hover { background:var(--green-bright); }
.btn-ghost { background:transparent; color:var(--text); border:1px solid var(--border); }
.btn-ghost:hover { border-color:var(--muted); }
.btn-danger { background:var(--danger); color:#fff; }
.btn-danger:hover { background:var(--danger-bright); }
.btn:disabled { opacity:0.35; cursor:not-allowed; }

.hint {
  background:var(--surface-2); border-left:3px solid var(--green);
  padding:10px 12px; border-radius:4px; font-size:0.74rem; color:var(--muted);
  line-height:1.5; margin-bottom:12px;
}
.hint b { color:var(--text); }
.hint.danger { border-left-color:var(--danger); }
.hint.warn { border-left-color:var(--gold); }

/* ===== KONTEYNER LİSTESİ ===== */
.container-list { display:flex; flex-direction:column; gap:10px; }
.container-list-item {
  background:var(--surface); border:1px solid var(--border);
  border-radius:6px; padding:14px; cursor:pointer;
  transition:border-color 0.2s, transform 0.1s;
  -webkit-tap-highlight-color:transparent;
}
.container-list-item:hover { border-color:var(--green); }
.container-list-item:active { transform:scale(0.98); }
.container-list-item .head {
  display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;
}
.container-list-item .head h3 { font-family:var(--font-head); font-size:0.95rem; font-weight:700; }
.container-list-item .head .sv {
  font-size:0.62rem; color:var(--green-bright); letter-spacing:1px;
  text-transform:uppercase; font-weight:600;
}
.container-list-item .name { font-size:0.7rem; color:var(--muted); margin-bottom:10px; }
.container-list-item .bar {
  height:6px; background:var(--surface-2); border-radius:3px; overflow:hidden;
}
.container-list-item .bar .fill {
  height:100%; background:var(--green); transition:width 0.3s;
}
.container-list-item .bar-info {
  display:flex; justify-content:space-between; font-size:0.6rem;
  color:var(--muted); margin-top:6px; letter-spacing:0.5px;
}
.container-list-item.add {
  border-style:dashed; text-align:center;
}
.container-list-item.add h3 {
  color:var(--green-bright); margin-bottom:4px; font-size:0.9rem;
}
.container-list-item.add .price {
  font-family:var(--font-head); color:var(--gold); font-weight:700; font-size:0.9rem;
}

/* ===== KONTEYNER İÇ GÖRÜNÜMÜ ===== */
.container-view-head {
  display:flex; align-items:center; justify-content:space-between;
  background:var(--surface); padding:12px 14px;
  border:1px solid var(--border); border-radius:6px;
  margin-bottom:12px; gap:10px;
}
.container-view-head .left {
  display:flex; align-items:center; gap:10px; min-width:0; flex:1;
}
.container-view-head .x-btn {
  background:transparent; border:1px solid var(--border); color:var(--muted);
  width:34px; height:34px; border-radius:4px; cursor:pointer;
  font-size:1.2rem; display:flex; align-items:center; justify-content:center;
  -webkit-tap-highlight-color:transparent; flex-shrink:0;
  transition:color 0.2s, border-color 0.2s;
}
.container-view-head .x-btn:hover { color:var(--danger-bright); border-color:var(--danger); }
.container-view-head .title-block { min-width:0; }
.container-view-head .title-block h3 {
  font-family:var(--font-head); font-size:0.95rem; font-weight:700;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.container-view-head .title-block .name {
  font-size:0.6rem; color:var(--muted);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.container-view-head .btn { flex-shrink:0; padding:9px 14px; font-size:0.66rem; }

.container-detail {
  background: var(--surface);
  border: 1px solid var(--green);
  border-radius: 6px;
  padding: 14px;
  margin-bottom: 14px;
  box-shadow: 0 0 12px rgba(106,168,79,0.08);
}

/* ===== SLOT GRID ===== */
.slot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.slot {
  aspect-ratio: 1; max-height: 130px;
  border-radius: 6px; border: 1px solid var(--border);
  background: var(--surface);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 6px; cursor: pointer;
  transition: border-color 0.2s, background 0.2s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
}

.slot:active { transform: scale(0.96); }

.slot.empty {
  border-style: dashed; color: var(--green-bright);
  font-size: 2rem; font-weight: 300;
  background: var(--surface-2);
}
.slot.empty:hover { border-color: var(--green); background: var(--surface); }

.slot.filled { border-color: var(--green); }
.slot.filled.ready {
  border-color: var(--green-bright);
  box-shadow: 0 0 12px rgba(139,195,74,0.3);
}
.slot.filled.bad { border-color: var(--danger); }

.slot-icon {
  font-size: 1.6rem;
  line-height: 1;
  margin-bottom: 4px;
}

.slot-phase {
  font-size: 0.48rem;
  color: var(--muted);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1.1;
  margin-bottom: 4px;
}

.slot-bar {
  width: 100%; height: 3px; background: var(--surface-2);
  border-radius: 2px; overflow: hidden; margin-top: auto;
}
.slot-fill {
  height: 100%; background: var(--green); transition: width 0.4s;
}

/* Ölü Partiler */
.dead-batches { margin-top:16px; }
.dead-title {
  font-size:0.62rem; letter-spacing:1.5px; text-transform:uppercase;
  color:var(--muted); font-weight:600; margin-bottom:8px;
}
.dead-batch {
  display:flex; justify-content:space-between; align-items:center;
  background:var(--surface); border:1px solid var(--border); border-radius:4px;
  padding:10px 12px; margin-bottom:6px; font-size:0.72rem; color:var(--muted);
}
.dead-batch .btn { padding:6px 10px; font-size:0.6rem; }

/* ===== GENEL KUTULAR ===== */
.container-card {
  background:var(--surface); border:1px solid var(--border); border-radius:6px;
  padding:14px; margin-bottom:12px;
}
.container-card h3 { font-family:var(--font-head); font-size:1rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:2px; }
.container-card .lvl { font-size:0.62rem; letter-spacing:2px; text-transform:uppercase; color:var(--green-bright); margin-bottom:10px; display:block; }
.stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px; }
.stat-cell { background:var(--surface-2); padding:7px 9px; border-radius:4px; }
.stat-cell .k { font-size:0.52rem; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); }
.stat-cell .v { font-family:var(--font-head); font-size:0.85rem; font-weight:700; }
.storage-bar { height:10px; background:var(--surface-2); border-radius:5px; overflow:hidden; margin:8px 0 14px; }
.storage-bar .fill { height:100%; background:var(--gold); border-radius:5px; transition:width 0.3s; }

/* ===== PAZAR ===== */
.mat-list { display:flex; flex-direction:column; gap:10px; }
.mat {
  background:var(--surface); border:1px solid var(--border);
  border-radius:5px; padding:10px 12px;
}
.mat-main { display:flex; align-items:center; gap:10px; margin-bottom:8px; }
.mat-main .ico { font-size:1.4rem; flex-shrink:0; }
.mat-main .info { flex:1; min-width:0; }
.mat-main .info .name { font-family:var(--font-head); font-size:0.82rem; font-weight:700; }
.mat-main .info .sub { font-size:0.62rem; color:var(--muted); }
.mat-main .own { font-family:var(--font-head); font-size:0.78rem; color:var(--green-bright); font-weight:700; white-space:nowrap; }
.mat-controls { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.mat-controls .btn { padding:7px 10px; font-size:0.62rem; flex-shrink:0; }
.qty-input {
  flex:1; min-width:70px; padding:7px 10px; background:var(--surface-2);
  border:1px solid var(--border); border-radius:4px;
  color:var(--text); font-family:var(--font-body); font-size:0.72rem; outline:none;
}
.qty-input:focus { border-color:var(--green); }
.qty-input::placeholder { color:var(--muted); font-size:0.65rem; }
.cart-box {
  background:var(--surface); border:1px solid var(--green);
  border-radius:5px; padding:14px; margin-top:14px;
}
.cart-box h3 {
  font-family:var(--font-head); font-size:0.9rem; text-transform:uppercase;
  letter-spacing:1px; margin-bottom:10px; color:var(--green-bright);
}
.cart-row {
  display:flex; align-items:center; gap:8px;
  font-size:0.72rem; padding:7px 0; border-bottom:1px solid var(--border);
}
.cart-row span:first-child { flex:1; }
.cart-row span:nth-child(2) { color:var(--gold); font-family:var(--font-head); font-weight:700; }
.cart-rm { background:transparent; border:none; color:var(--muted); font-size:1.15rem; cursor:pointer; padding:0 4px; line-height:1; }
.cart-rm:hover { color:var(--danger-bright); }
.cart-total { display:flex; justify-content:space-between; align-items:center; padding:12px 0 6px; }
.cart-total span:first-child { font-size:0.7rem; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); }
.cart-total .big { font-family:var(--font-head); font-size:1.2rem; color:var(--gold); font-weight:700; }
.cart-btns { display:flex; gap:8px; margin-top:8px; }
.cart-btns .btn { flex:1; }
.sell-box {
  background:var(--surface); border:1px solid var(--border); border-radius:5px;
  padding:14px; margin-top:14px;
}
.sell-box h3 { font-family:var(--font-head); font-size:0.9rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }
.sell-row { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; }
.sell-row .big { font-family:var(--font-head); font-size:1.2rem; color:var(--gold); font-weight:700; }

/* ===== USTALAR ===== */
.master-card {
  background:var(--surface); border:1px solid var(--border); border-radius:5px;
  padding:12px 14px; margin-bottom:10px;
}
.master-card.hired { border-color:var(--green); box-shadow:0 0 12px rgba(106,168,79,0.1); }
.master-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; gap:8px; }
.master-name { font-family:var(--font-head); font-size:0.95rem; font-weight:700; letter-spacing:0.5px; }
.master-stars { color:var(--star); font-size:0.9rem; letter-spacing:1px; white-space:nowrap; }
.master-info { display:flex; justify-content:space-between; align-items:center; font-size:0.68rem; color:var(--muted); margin-bottom:10px; gap:8px; flex-wrap:wrap; }
.master-info .mtype { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:3px; background:var(--surface-2); color:var(--text); font-weight:600; letter-spacing:0.5px; }
.master-info .msalary { color:var(--gold); font-family:var(--font-head); font-weight:700; }
.master-actions { display:flex; gap:6px; }
.master-actions .btn { flex:1; padding:8px 12px; font-size:0.66rem; }
.master-effect { font-size:0.65rem; color:var(--muted); line-height:1.45; padding:6px 0; border-top:1px dashed var(--border); margin-bottom:8px; }
.master-effect b { color:var(--green-bright); }
.setting-row {
  display:flex; flex-direction:column; gap:4px; margin-bottom:12px;
  background:var(--surface); border:1px solid var(--border); border-radius:5px; padding:10px 12px;
}
.setting-row label { font-size:0.62rem; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); font-weight:600; }
.setting-select {
  padding:9px 10px; background:var(--surface-2); border:1px solid var(--border);
  border-radius:4px; color:var(--text); font-family:var(--font-body); font-size:0.82rem;
  outline:none; cursor:pointer;
}
.setting-select:focus { border-color:var(--green); }

/* ===== MODAL ===== */
.modal-back {
  position:fixed; inset:0; z-index:30; background:rgba(0,0,0,0.8);
  backdrop-filter:blur(4px); display:none; align-items:center; justify-content:center; padding:16px;
}
.modal-back.on { display:flex; }
.modal {
  background:var(--surface); border:1px solid var(--border); border-radius:6px;
  padding:22px 18px; width:100%; max-width:440px; max-height:90vh; overflow-y:auto;
  animation:pop 0.2s ease both;
}
@keyframes pop { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
.modal h2 { font-family:var(--font-head); font-size:1.05rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
.modal .sub { font-size:0.64rem; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-bottom:16px; display:block; }
.recipe {
  background:var(--surface-2); border-radius:4px; padding:10px 12px;
  font-size:0.72rem; color:var(--muted); line-height:1.7; margin-bottom:14px;
}
.recipe b { color:var(--text); }
.method {
  display:flex; align-items:center; gap:10px; background:var(--surface-2);
  border:1px solid var(--border); border-radius:5px; padding:12px; margin-bottom:8px;
  cursor:pointer; transition:border-color 0.2s; -webkit-tap-highlight-color:transparent;
}
.method:hover { border-color:var(--green); }
.method.disabled { opacity:0.4; cursor:not-allowed; }
.method .m-ico { font-size:1.4rem; flex-shrink:0; }
.method .m-info { flex:1; }
.method .m-info .m-name { font-family:var(--font-head); font-size:0.85rem; font-weight:700; text-transform:uppercase; }
.method .m-info .m-desc { font-size:0.64rem; color:var(--muted); margin-top:2px; }
.modal .close { margin-top:10px; width:100%; padding:11px; background:transparent; color:var(--muted); border:1px solid var(--border); border-radius:4px; font-family:var(--font-body); font-size:0.72rem; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; }
.modal .close:hover { color:var(--text); }

/* Parti Detay (Modal İçi) */
.batch-detail { display:flex; flex-direction:column; gap:8px; margin-bottom:14px; }
.batch-detail .bd-row {
  display:flex; justify-content:space-between; align-items:center;
  font-size:0.78rem; padding:6px 0; border-bottom:1px solid var(--border);
}
.batch-detail .bd-row:last-child { border-bottom:none; }
.batch-detail .bd-row .k { color:var(--muted); }
.batch-detail .bd-row .v { font-family:var(--font-head); font-weight:700; color:var(--text); }
.batch-detail .bd-row .v.danger { color:var(--danger-bright); }
.batch-detail .bd-row .v.green { color:var(--green-bright); }

/* Yükseltme Karşılaştırma */
.upgrade-compare { display:flex; gap:10px; margin-bottom:14px; }
.upgrade-compare .col { flex:1; background:var(--surface-2); border-radius:5px; padding:12px 10px; }
.upgrade-compare .col h4 { font-size:0.58rem; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); font-weight:600; margin-bottom:8px; }
.upgrade-compare .col .row { display:flex; justify-content:space-between; align-items:center; font-size:0.68rem; margin-bottom:5px; }
.upgrade-compare .col .row:last-child { margin-bottom:0; }
.upgrade-compare .col .row .k { color:var(--muted); }
.upgrade-compare .col .row .v { font-family:var(--font-head); font-weight:700; color:var(--text); }
.upgrade-compare .col .row .v.up { color:var(--green-bright); }
.upgrade-cost { background:var(--surface-2); border-radius:5px; padding:12px; text-align:center; margin-bottom:14px; }
.upgrade-cost .lbl { font-size:0.6rem; letter-spacing:1.5px; text-transform:uppercase; color:var(--muted); margin-bottom:4px; }
.upgrade-cost .val { font-family:var(--font-head); font-size:1.3rem; font-weight:700; color:var(--gold); }
.upgrade-cost .val.poor { color:var(--danger-bright); }

/* ===== CHAT ===== */
.chat-toggle {
  position:fixed; bottom:calc(18px + env(safe-area-inset-bottom)); right:16px;
  width:52px; height:52px; border-radius:50%; background:var(--green);
  border:none; color:#0a0c08; font-size:1.3rem; cursor:pointer; z-index:15;
  box-shadow:0 4px 18px rgba(106,168,79,0.4); -webkit-tap-highlight-color:transparent;
  display:flex; align-items:center; justify-content:center; transition:transform 0.15s;
}
.chat-toggle:active { transform:scale(0.92); }
.chat-toggle .badge {
  position:absolute; top:-2px; right:-2px; min-width:17px; height:17px;
  border-radius:9px; background:var(--danger); color:#fff; font-size:0.58rem;
  font-weight:700; display:none; align-items:center; justify-content:center; padding:0 4px;
}
.chat-toggle .badge.on { display:flex; }
.chat-panel {
  position:fixed; top:0; right:0; bottom:0; width:360px; max-width:100vw;
  background:var(--surface); border-left:1px solid var(--border); z-index:16;
  display:flex; flex-direction:column; transform:translateX(100%);
  transition:transform 0.3s ease; padding-top:env(safe-area-inset-top);
  padding-bottom:env(safe-area-inset-bottom);
}
.chat-panel.open { transform:translateX(0); }
.chat-head { flex-shrink:0; display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid var(--border); font-family:var(--font-head); font-size:0.9rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; gap:10px; }
.chat-head .online { font-family:var(--font-body); font-size:0.58rem; letter-spacing:1px; color:var(--muted); text-transform:none; font-weight:500; white-space:nowrap; }
.chat-head .online::before { content:''; display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--green); margin-right:5px; vertical-align:middle; }
.chat-head .online.off::before { background:var(--danger); }
.chat-close { background:transparent; border:none; color:var(--muted); font-size:1.3rem; cursor:pointer; padding:0 6px; line-height:1; }
.chat-messages { flex:1; overflow-y:auto; padding:10px 12px; display:flex; flex-direction:column; gap:7px; -webkit-overflow-scrolling:touch; }
.chat-empty { text-align:center; color:var(--muted); font-size:0.74rem; margin-top:36px; padding:0 18px; }
.msg { display:flex; flex-direction:column; max-width:85%; }
.msg.self { align-self:flex-end; align-items:flex-end; }
.msg .who { font-size:0.58rem; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:var(--muted); margin-bottom:2px; padding:0 4px; }
.msg.self .who { color:var(--green-bright); }
.msg .body { background:var(--surface-2); border:1px solid var(--border); padding:6px 10px; border-radius:7px; font-size:0.8rem; line-height:1.4; word-wrap:break-word; overflow-wrap:break-word; }
.msg.self .body { background:rgba(106,168,79,0.15); border-color:rgba(106,168,79,0.4); }
.msg .time { font-size:0.52rem; color:var(--muted); margin-top:2px; padding:0 4px; }
.chat-form { flex-shrink:0; display:flex; gap:6px; padding:8px 10px; border-top:1px solid var(--border); background:var(--surface); }
.chat-form input { flex:1; padding:9px 11px; background:var(--bg); border:1px solid var(--border); border-radius:4px; color:var(--text); font-family:var(--font-body); font-size:0.82rem; outline:none; min-width:0; }
.chat-form input:focus { border-color:var(--green); }
.chat-form input::placeholder { color:var(--muted); }
.chat-form input:disabled { opacity:0.5; }
.chat-form button { padding:9px 14px; background:var(--green); color:#0a0c08; border:none; border-radius:4px; font-family:var(--font-body); font-size:0.7rem; font-weight:600; letter-spacing:1px; text-transform:uppercase; cursor:pointer; }
.chat-form button:disabled { opacity:0.4; cursor:not-allowed; }

@media (max-width:520px) {
  .stat .val { font-size:0.78rem; }
  .stat .lbl { font-size:0.46rem; }
  .tab { font-size:0.58rem; padding:10px 4px; }
  .speed-btn { font-size:0.56rem; padding:5px 6px; }
  .chat-panel { width:100vw; }
  .slot-grid { grid-template-columns:repeat(auto-fill, minmax(78px, 1fr)); gap:6px; }
  .slot-icon { font-size:1.4rem; }
  .slot-phase { font-size:0.44rem; }
    }
