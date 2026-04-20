import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

const oldError = console.error;
window.addEventListener('error', (e) => {
  document.body.innerHTML += `<div style="color: red; position: absolute; z-index: 9999; font-size: 16px; background: black;">${e.error?.stack || e.message}</div>`;
});
console.error = (...args) => {
  const msg = args.map(a => (a?.stack || a?.message || String(a))).join(' ');
  if (msg.includes('THREE.TSL')) {
      document.body.innerHTML += `<div style="color: red; position: absolute; z-index: 9999; font-size: 16px; background: black;">${msg}</div>`;
  } else if (!msg.includes('Deprecated')) {
      document.body.innerHTML += `<div style="color: magenta; position: absolute; z-index: 9998; font-size: 12px; background: black;">${msg}</div>`;
  }
  oldError(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
