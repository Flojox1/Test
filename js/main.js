import { requireVerifiedUser } from './auth.js';
import { init } from './game.js';

try {
  const user = await requireVerifiedUser();
  if (!user) {
    window.location.replace('index.html');
  } else {
    document.documentElement.dataset.accountEmail = user.email || '';
    init();
  }
} catch (error) {
  console.error('Hesap doğrulaması başarısız:', error);
  window.location.replace('index.html');
}
