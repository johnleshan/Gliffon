import { h, render } from 'preact';
import { App } from './app.jsx';
import './styles.css';

window.addEventListener('error', (e) => {
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:99;background:#b3122f;color:#fff;padding:10px 16px;border-radius:10px;font:12px system-ui;max-width:90vw';
  box.textContent = 'Gliffon error: ' + e.message;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 8000);
});

// Brand is Midnight-only now (the old Ember skin is retired).
// Apply it before first paint so there is never a flash of the wrong look.
try {
  document.documentElement.dataset.theme = 'midnight';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#0a0f22');
} catch {}

// PWA self-update: a deploy ships a new service worker; when it takes over,
// the open page is still running the previous bundle. Reload exactly once so
// users are always on the deployed version instead of silently holding a
// stale app that drifts out of sync with the site (the reported "not
// responsive / missing features" ghost). First installs (no old controller)
// never reload, so there is no first-launch flash.
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  // Browsers only re-check for a new worker on navigation; while the app stays
  // open (PWA), poll so a deploy reaches open devices without waiting.
  setInterval(() => {
    navigator.serviceWorker.getRegistration().then((r) => r && r.update().catch(() => {}));
  }, 60_000);
}

render(h(App), document.getElementById('app'));
