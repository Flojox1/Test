import { chatEnabled } from './config.js';
import { getFirebaseAuth, getFirebaseApp } from './firebase.js';

const chatToggle = document.getElementById('chatToggle');
const chatPanel = document.getElementById('chatPanel');
const chatClose = document.getElementById('chatClose');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');
const chatMessages = document.getElementById('chatMessages');
const chatStatus = document.getElementById('chatStatus');
const chatBadge = document.getElementById('chatBadge');

let chatOpen = false, unread = 0;
export function isChatOpen(){return chatOpen;}
export function closeChat(){if(!chatOpen)return false;chatOpen=false;chatPanel.classList.remove('open');refreshBadge();return true;}
let myName = '';
let firstLoad = true;

function refreshBadge() {
  if (unread > 0 && !chatOpen) {
    chatBadge.textContent = unread > 99 ? '99+' : unread;
    chatBadge.classList.add('on');
  } else chatBadge.classList.remove('on');
}

chatToggle.addEventListener('click', () => {
  chatOpen = !chatOpen;
  chatPanel.classList.toggle('open', chatOpen);
  if (chatOpen) {
    unread = 0; refreshBadge(); chatInput.focus();
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
});
chatClose.addEventListener('click', closeChat);

function addMessage(msg, isSelf, messageId) {
  const empty = chatMessages.querySelector('.chat-empty');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = 'msg' + (isSelf ? ' self' : '');
  if (messageId) div.dataset.messageId = messageId;
  const who = document.createElement('span');
  who.className = 'who';
  who.textContent = isSelf ? 'Sen' : (msg.name || 'Anonim');
  const body = document.createElement('div');
  body.className = 'body';
  body.textContent = msg.text || '';
  const time = document.createElement('span');
  time.className = 'time';
  const d = new Date(msg.ts || Date.now());
  time.textContent = d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
  div.appendChild(who); div.appendChild(body); div.appendChild(time);
  chatMessages.appendChild(div);
  if (!firstLoad && !chatOpen && !isSelf) { unread++; refreshBadge(); }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

export async function initChat() {
  if (!chatEnabled) {
    chatStatus.textContent = 'Kapalı';
    chatStatus.classList.add('off');
    chatInput.placeholder = 'Sohbet yapılandırılmadı';
    return;
  }
  try {
    const app = await getFirebaseApp();
    const auth = await getFirebaseAuth();
    if (!auth.currentUser || !auth.currentUser.emailVerified) throw new Error('Doğrulanmış hesap gerekli.');
    const { getDatabase, ref, push, onChildAdded, onChildRemoved, query, limitToLast, get, onValue } =
      await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
    const db = getDatabase(app);
    const profile = await get(ref(db, `users/${auth.currentUser.uid}/profile`));
    myName = profile.val()?.name || 'Oyuncu';
    onValue(ref(db, 'settings/chatEnabled'), snap => {
      const enabled = !snap.exists() || snap.val() !== false;
      chatInput.disabled = !enabled;
      chatSend.disabled = !enabled;
      chatInput.placeholder = enabled ? 'Mesaj yaz...' : 'Sohbet yönetici tarafından kapatıldı';
      chatStatus.textContent = enabled ? 'Bağlı' : 'Sohbet kapalı';
      chatStatus.classList.toggle('off', !enabled);
    });
    chatStatus.textContent = 'Bağlı';
    chatStatus.classList.remove('off');
    chatInput.disabled = false;
    chatSend.disabled = false;
    const chatRef = query(ref(db, 'chat'), limitToLast(50));
    onChildAdded(chatRef, (snap) => {
      const msg = snap.val();
      if (!msg) return;
      addMessage(msg, msg.name === myName, snap.key);
    });
    onChildRemoved(chatRef, snap => {
      const removed = chatMessages.querySelector(`[data-message-id="${snap.key}"]`);
      if (removed) removed.remove();
      if (!chatMessages.querySelector('.msg')) {
        const empty = document.createElement('div'); empty.className = 'chat-empty'; empty.textContent = 'Henüz mesaj yok. İlk konuşan sen ol.'; chatMessages.appendChild(empty);
      }
    });
    setTimeout(() => { firstLoad = false; }, 1500);
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      if (!myName) { alert('Oyuncu adın bulunamadı. Sayfayı yenile.'); return; }
      chatInput.value = '';
      try { await push(ref(db, 'chat'), { name: myName, text: text.slice(0,200), ts: Date.now() }); }
      catch (err) { alert('Mesaj gönderilemedi: ' + err.message); }
    });
  } catch (err) {
    chatStatus.textContent = 'Hata';
    chatStatus.classList.add('off');
    console.error(err);
  }
}
