function parseAdminMoney(input){
 const raw=String(input??'').trim().toLowerCase().replace(/\s+/g,'').replace(/₺/g,'').replace(/,/g,'.');
 const match=raw.match(/^([0-9]+(?:\.[0-9]+)?)(mr|m|b)?$/);
 if(!match)return NaN;
 const value=Number(match[1]),suffix=match[2]||'';
 const multiplier=suffix==='b'?1000:suffix==='m'?1000000:suffix==='mr'?1000000000:1;
 const result=value*multiplier;
 return Number.isSafeInteger(Math.round(result))?Math.round(result):NaN;
}
import { getFirebaseApp, getFirebaseAuth } from './firebase.js';
const WORKER='https://email.akar4dogukan.workers.dev';
const $=id=>document.getElementById(id);
let dbMod=null, chatEnabled=true, playersCache=[];
async function auth(){return getFirebaseAuth();}
async function api(path,body){
 const a=await auth(),u=a.currentUser;if(!u)throw new Error('Admin oturumu kapandı.');
 const token=await u.getIdToken();
 const r=await fetch(WORKER+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'İşlem başarısız.');return d;
}
function status(t,error=false){$('adminStatus').textContent=t;$('adminStatus').style.color=error?'#ff8989':'var(--gold)';}
async function login(e){
 e.preventDefault();status('Giriş yapılıyor...');
 try{
  const r=await fetch(WORKER+'/admin-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('adminUser').value,password:$('adminPass').value})});
  const d=await r.json();if(!r.ok)throw new Error(d.error||'Giriş başarısız.');
  const app=await getFirebaseApp();const {getAuth,signInWithCustomToken,setPersistence,browserLocalPersistence}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const a=getAuth(app);await setPersistence(a,browserLocalPersistence);await signInWithCustomToken(a,d.customToken);
 }catch(err){status(err.message,true);}
}
async function loadPlayers(){
 $('playersList').textContent='Yükleniyor...';
 try{
  const d=await api('/admin/players');
  playersCache=d.players||[];
  renderPlayers();
 }catch(e){$('playersList').textContent=e.message;}
}
function renderPlayers(){
 $('playersList').innerHTML='';
 const query=String($('playerSearch')?.value||'').trim().toLocaleLowerCase('tr-TR');
 const filtered=playersCache.filter(p=>String(p.name||'').toLocaleLowerCase('tr-TR').includes(query));
 if(!filtered.length){$('playersList').textContent=playersCache.length?'Aramayla eşleşen oyuncu yok.':'Henüz oyuncu kaydı yok.';return;}
 filtered.forEach(p=>{
  const row=document.createElement('div');row.className='admin-row';
  const info=document.createElement('div');
  const name=document.createElement('b');name.textContent=p.name;
  const meta=document.createElement('div');meta.className='admin-muted';
  const updateMeta=()=>{meta.textContent=(p.email||p.uid)+' · ₺'+Number(p.money||0).toLocaleString('tr-TR');};
  updateMeta();info.append(name,meta);
  const actions=document.createElement('div');actions.className='admin-actions';
  const money=document.createElement('button');money.className='btn btn-green';money.textContent='Para ekle';
  money.onclick=async()=>{const raw=prompt('Eklenecek para miktarı (ör. 1500, 1.5b, 2.78m, 1mr):','1000');if(raw===null)return;const amount=parseAdminMoney(raw);if(!Number.isFinite(amount)||amount<=0){alert('Geçersiz miktar.');return;}money.disabled=true;try{const result=await api('/admin/player-action',{action:'addMoney',uid:p.uid,amount});p.money=Number(result.money);updateMeta();money.textContent='Eklendi ✓';setTimeout(()=>{money.textContent='Para ekle';money.disabled=false;},900);}catch(e){money.disabled=false;alert(e.message);}};
  const removeMoney=document.createElement('button');removeMoney.className='btn admin-danger';removeMoney.textContent='Para çıkar';
  removeMoney.onclick=async()=>{const raw=prompt('Çıkarılacak para miktarı (ör. 1500, 1.5b, 2.78m, 1mr):','1000');if(raw===null)return;const amount=parseAdminMoney(raw);if(!Number.isFinite(amount)||amount<=0){alert('Geçersiz miktar.');return;}if(!confirm(p.name+' oyuncusundan ₺'+amount.toLocaleString('tr-TR')+' çıkarılsın mı?'))return;removeMoney.disabled=true;try{const result=await api('/admin/player-action',{action:'removeMoney',uid:p.uid,amount});p.money=Number(result.money);updateMeta();removeMoney.textContent='Çıkarıldı ✓';setTimeout(()=>{removeMoney.textContent='Para çıkar';removeMoney.disabled=false;},900);}catch(e){removeMoney.disabled=false;alert(e.message);}};
  const reset=document.createElement('button');reset.className='btn btn-ghost';reset.textContent='Sıfırla';
  reset.onclick=async()=>{if(!confirm(p.name+' oyuncusunun oyun kaydı sıfırlansın mı?'))return;try{await api('/admin/player-action',{action:'reset',uid:p.uid});await loadPlayers();}catch(e){alert(e.message);}};
  const ban=document.createElement('button');ban.className='btn admin-danger';ban.textContent='Banla';
  ban.onclick=async()=>{if(!confirm(p.name+' hesabı banlansın mı?'))return;try{await api('/admin/player-action',{action:'ban',uid:p.uid});await loadPlayers();}catch(e){alert(e.message);}};
  const unban=document.createElement('button');unban.className='btn btn-ghost';unban.textContent='Banı kaldır';
  unban.onclick=async()=>{try{await api('/admin/player-action',{action:'unban',uid:p.uid});alert('Ban kaldırıldı.');}catch(e){alert(e.message);}};
  actions.append(money,removeMoney,reset,ban,unban);row.append(info,actions);$('playersList').append(row);
 });
}
async function loadChat(){
 $('chatList').textContent='Yükleniyor...';
 try{
  const d=await api('/admin/chat');$('chatList').innerHTML='';
  d.messages.forEach(m=>{
   const row=document.createElement('div');row.className='admin-row';
   const content=document.createElement('div');content.style.flex='1';
   const who=document.createElement('b');who.textContent=m.name||'Anonim';
   const body=document.createElement('div');body.textContent=m.text||'';
   const time=document.createElement('small');time.className='admin-muted';time.textContent=new Date(m.ts||Date.now()).toLocaleString('tr-TR');
   content.append(who,body,time);
   const del=document.createElement('button');del.className='btn admin-danger';del.textContent='Sil';
   del.onclick=async()=>{if(!confirm('Bu mesaj silinsin mi?'))return;del.disabled=true;try{await api('/admin/chat-action',{action:'delete',id:m.id});row.remove();if(!$('chatList').querySelector('.admin-row'))$('chatList').textContent='Sohbette mesaj yok.';}catch(e){del.disabled=false;alert(e.message);}};
   row.append(content,del);$('chatList').append(row);
  });
  if(!d.messages.length)$('chatList').textContent='Sohbette mesaj yok.';
  chatEnabled=d.chatEnabled!==false;
  $('chatToggleAdmin').textContent=chatEnabled?'Sohbeti kapat':'Sohbeti aç';$('chatToggleAdmin').classList.toggle('admin-danger',chatEnabled);$('chatToggleAdmin').classList.toggle('admin-ok',!chatEnabled);$('chatStateLabel').textContent=chatEnabled?'Sohbet açık':'Sohbet kapalı';
 }catch(e){$('chatList').textContent=e.message;}
}
$('adminLogin').addEventListener('submit',login);
$('refreshPlayers').addEventListener('click',loadPlayers);
$('playerSearch').addEventListener('input',renderPlayers);
$('adminLogout').addEventListener('click',async()=>{const a=await auth();await (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js')).signOut(a);$('dashboard').hidden=true;$('loginCard').hidden=false;});
let chatPoll=null;document.querySelectorAll('[data-admin-tab]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-admin-tab]').forEach(x=>x.classList.toggle('active',x===b));$('playersPane').hidden=b.dataset.adminTab!=='players';$('chatPane').hidden=b.dataset.adminTab!=='chat';if(b.dataset.adminTab==='chat'){loadChat();if(chatPoll)clearInterval(chatPoll);chatPoll=setInterval(()=>{if(!document.hidden&&!$('chatPane').hidden)loadChat();},4000);}else if(chatPoll){clearInterval(chatPoll);chatPoll=null;}}));
$('chatToggleAdmin').addEventListener('click',async()=>{try{await api('/admin/chat-action',{action:'toggle',enabled:!chatEnabled});chatEnabled=!chatEnabled;$('chatToggleAdmin').textContent=chatEnabled?'Sohbeti kapat':'Sohbeti aç';$('chatToggleAdmin').classList.toggle('admin-danger',chatEnabled);$('chatToggleAdmin').classList.toggle('admin-ok',!chatEnabled);$('chatStateLabel').textContent=chatEnabled?'Sohbet açık':'Sohbet kapalı';}catch(e){alert(e.message);}});
$('clearChat').addEventListener('click',async()=>{if(!confirm('Tüm sohbet mesajları kalıcı olarak silinsin mi?'))return;try{await api('/admin/chat-action',{action:'clear'});await loadChat();}catch(e){alert(e.message);}});

async function showDashboard(){
 $('loginCard').hidden=true;$('dashboard').hidden=false;status('');
 await loadPlayers();
}
(async()=>{
 try{
  const app=await getFirebaseApp();
  const {getAuth,onAuthStateChanged}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const a=getAuth(app);
  onAuthStateChanged(a,async user=>{
   if(user && user.uid==='florod-admin'){try{await showDashboard();}catch(e){status(e.message,true);}}
   else {$('dashboard').hidden=true;$('loginCard').hidden=false;}
  });
 }catch(e){status(e.message,true);}
})();
