// Mini cliente CDP (sem dependências) para dirigir o Chrome headless.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export const HELPERS = `
window.__vis1 = (e) => { const r = e.getBoundingClientRect(); if (r.width === 0 || r.x < -1 || r.x >= innerWidth) return false;
  for (let p = e; p; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
window.__find = (t) => { const els = [...document.querySelectorAll('div,span,button,a,[role]')].filter(e => e.innerText && e.innerText.trim() === t && __vis1(e)); return els[els.length - 1]; };
window.__clickable = (el) => { let c = el; while (c && !(c.getAttribute('tabindex') !== null || ['button','tab','radio','switch','link'].includes(c.getAttribute('role')) || c.tagName === 'BUTTON' || c.tagName === 'A')) c = c.parentElement; return c || el; };
window.__click = (t) => { const el = __find(t); if (!el) throw new Error('not found: ' + t); __clickable(el).click(); return 'clicked ' + t; };
window.__clickLabel = (l) => { const el = [...document.querySelectorAll('[aria-label="' + l + '"]')].find(__vis1); if (!el) throw new Error('no label: ' + l); el.click(); return 'clicked ' + l; };
window.__vis = () => [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && e.innerText && e.innerText.trim() && __vis1(e)).map(e => e.innerText.trim()).join(' | ');
window.__sleep = (ms) => new Promise(r => setTimeout(r, ms));
window.__input = (key) => [...document.querySelectorAll('input')].find(i => __vis1(i) && (i.placeholder === key || i.getAttribute('aria-label')?.startsWith(key)));
window.__set = (key, v) => { const el = __input(key); if (!el) throw new Error('no input ' + key); el.focus(); const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); return el; };
window.__blur = (key) => { const el = __input(key); el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); el.dispatchEvent(new FocusEvent('blur')); };
window.__scrollTo = (t, block = 'start') => { const el = __find(t); if (!el) throw new Error('scroll: not found ' + t); el.scrollIntoView({ block }); return 'ok'; };
window.__hold = async (label, ms) => { const btn = [...document.querySelectorAll('[aria-label="' + label + '"]')].find(__vis1); const r = btn.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, composed: true, view: window, clientX: r.x + 10, clientY: r.y + 10, button: 0, detail: 1 };
  btn.dispatchEvent(new MouseEvent('mousedown', { ...o, buttons: 1 })); await __sleep(ms); return () => document.dispatchEvent(new MouseEvent('mouseup', { ...o, buttons: 0 })); };
`;

export async function launch({ port = 9333, profile, width = 390, height = 844 }) {
  fs.rmSync(profile, { recursive: true, force: true });
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });
  let list;
  for (let i = 0; i < 60; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.some(t => t.type === 'page')) break; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  const page = list.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) listeners.forEach(l => l(m));
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, (m) => m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
  // Sem foco de janela o headless não dispara eventos focus/blur; a emulação os habilita.
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: HELPERS });
  const console_ = [];
  listeners.push((m) => {
    if (m.method === 'Runtime.exceptionThrown') console_.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 400));
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) console_.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 800));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  const navigate = async (url) => { await send('Page.navigate', { url }); };
  const shot = async (file) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  };
  const close = () => { try { ws.close(); } catch {} proc.kill(); };
  return { send, evaluate, navigate, shot, close, console: console_ };
}
