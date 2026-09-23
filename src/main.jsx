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

render(h(App), document.getElementById('app'));
