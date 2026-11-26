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
let myName = localStorage.getItem('florod_name') || '';
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
chatClose.addEventListener('click', () => {
  chatOpen = false; chatPanel.classList.remove('open'); refreshBadge();
});

function addMessage(msg, isSelf) {
  const empty = chatMessages.querySelector('.chat-empty');
  if (empty) empty.remove();
  const div = document.createElement('div');
  div.className = 'msg' + (isSelf ? ' self' : '');
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
    const { getDatabase, ref, push, onChildAdded, query, limitToLast } =
      await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
    const { getDatabase: getDb } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
    const db = getDb(app);
    chatStatus.textContent = 'Bağlı';
    chatStatus.classList.remove('off');
    chatInput.disabled = false;
    chatSend.disabled = false;
    const chatRef = query(ref(db, 'chat'), limitToLast(50));
    onChildAdded(chatRef, (snap) => {
      const msg = snap.val();
      if (!msg) return;
      addMessage(msg, msg.name === myName);
    });
    setTimeout(() => { firstLoad = false; }, 1500);
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      if (!myName) {
        const entered = prompt('Sohbette görünecek adın:');
        if (!entered || !entered.trim()) return;
        myName = entered.trim().slice(0,20);
        localStorage.setItem('florod_name', myName);
      }
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
