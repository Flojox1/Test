// >>> FIREBASE CONFIG'İNİ BURAYA YAPIŞTIR <<<
export const firebaseConfig = {
  apiKey: "AIzaSyDJiFeWavz6uYOzzgfm9JecVM9XLj40UN8",
  authDomain: "chat-f3082.firebaseapp.com",
  databaseURL: "https://chat-f3082-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "chat-f3082",
  storageBucket: "chat-f3082.firebasestorage.app",
  messagingSenderId: "393623340353",
  appId: "1:393623340353:web:6cf46734c5440c1077cdc0",
};

export const chatEnabled = !firebaseConfig.apiKey.startsWith("YOUR_");
