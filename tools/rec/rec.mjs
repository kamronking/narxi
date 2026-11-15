// Records a real walk-through of narxi.site for promo videos (brand name blurred).
import { chromium } from 'playwright';
import fs from 'fs';
const OUT = 'out'; fs.mkdirSync(OUT + '/f', { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true, locale: 'uz-UZ' });
await c.addInitScript(() => {
  try { localStorage.setItem('narxi_lang', '"uz"'); localStorage.setItem('narxi_theme', '"light"'); sessionStorage.setItem('ob_shown', '1'); sessionStorage.setItem('reg_shown', '1') } catch (e) {}
  const css = `header .logo{filter:blur(9px)!important}.__bl{filter:blur(7px)!important}
  #__tap{position:fixed;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(15,107,79,.28);border:3px solid rgba(15,107,79,.75);z-index:99999;pointer-events:none;opacity:0;transform:scale(.4);transition:opacity .15s,transform .35s}`;
  const RX = /Narxi|narxi\.site|narx_support/;
  const scan = () => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (RX.test(n.nodeValue)) { let e = n.parentElement; if (e && e.closest('header')) continue; if (e && (e.textContent || '').length < 60) e.classList.add('__bl') } } };
  addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); const d = document.createElement('div'); d.id = '__tap'; document.body.appendChild(d); scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true, characterData: true }) });
  window.__tap = (x, y) => { const d = document.getElementById('__tap'); d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.transition = 'none'; d.style.opacity = '1'; d.style.transform = 'scale(.4)'; requestAnimationFrame(() => { d.style.transition = 'opacity .5s .25s,transform .45s'; d.style.transform = 'scale(1.3)'; d.style.opacity = '0' }) };
});
const p = await c.newPage();
const cdp = await c.newCDPSession(p);
const frames = []; let t0 = null; const marks = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  if (t0 === null) t0 = metadata.timestamp; const i = frames.length; const f = `${OUT}/f/${String(i).padStart(5, '0')}.jpg`;
  fs.writeFileSync(f, Buffer.from(data, 'base64')); frames.push([f, metadata.timestamp - t0]);
  try { await cdp.send('Page.screencastFrameAck', { sessionId }) } catch (e) {}
});
const mark = n => { marks.push([n, t0 === null ? 0 : Date.now() / 1000 - t0wall]); console.log('mark', n) };
let t0wall = 0;
await p.goto('https://narxi.site/?utm_source=promo', { waitUntil: 'networkidle' });
await p.waitForSelector('#grid .pc', { timeout: 60000 }); await sleep(2500);
await p.evaluate(() => { try { if (!ob.hidden) closeOB() } catch (e) {} });
await sleep(800);
t0wall = Date.now() / 1000;
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
const tap = async (sel) => { const el = typeof sel === 'string' ? await p.$(sel) : sel; const bb = await el.boundingBox(); const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2; await p.evaluate(([x, y]) => __tap(x, y), [x, y]); await sleep(260); return [x, y] };
const smooth = async (dy, ms) => { const steps = Math.round(ms / 16); for (let i = 0; i < steps; i++) { const k = (1 - Math.cos(Math.PI * (i + 1) / steps)) / 2 - (1 - Math.cos(Math.PI * i / steps)) / 2; await p.evaluate(d => scrollBy(0, d), dy * k); await sleep(16) } };
const scrollTo = async (sel, ms = 1200, off = 140) => { const y = await p.evaluate(([s, o]) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top - o : 0 }, [sel, off]); await smooth(y, ms) };
mark('home'); await sleep(2500); await smooth(520, 2200); await sleep(1500); await smooth(-520, 1400); await sleep(800);
mark('about'); await p.evaluate(() => go('about')); await sleep(1800); await smooth(520, 2500); await sleep(2500);
mark('find'); await p.evaluate(() => go('find')); await sleep(1300);
const qi = await p.$('#qi') || await p.$('main input'); await tap(qi); await qi.click(); await sleep(400);
mark('type'); await p.keyboard.type('iPhone 17 Pro Max', { delay: 130 }); await p.keyboard.press('Enter').catch(() => {}); await sleep(2600);
mark('results'); await smooth(260, 1200); await sleep(1200);
const card = await p.evaluateHandle(() => [...document.querySelectorAll('#grid .pc')].find(e => /17 Pro Max/i.test(e.textContent) && /256/.test(e.textContent)) || document.querySelector('#grid .pc'));
await tap(card); await card.click(); await sleep(2600);
mark('product'); await sleep(1500); await smooth(420, 2200); await sleep(1800); await smooth(380, 2000); await sleep(1800);
mark('tg'); await scrollTo('#tgw', 1400, 300); await sleep(700); await tap('#tgw'); await sleep(2600);
mark('inst'); await scrollTo('#icalc', 1600, 120); await sleep(1800);
for (const lbl of ['6', '12', '24']) { const h = await p.evaluateHandle(l => [...document.querySelectorAll('#icalc button')].find(b => b.textContent.trim().startsWith(l)), lbl); if (h && (await h.evaluate(x => !!x))) { mark('term' + lbl); await tap(h); await h.click(); await sleep(2300) } }
await smooth(300, 1500); await sleep(1500);
mark('top'); await smooth(-4000, 1800); await sleep(1500); await p.evaluate(() => go('home')); await sleep(3000);
mark('end');
await cdp.send('Page.stopScreencast'); await sleep(500);
fs.writeFileSync(`${OUT}/frames.json`, JSON.stringify(frames)); fs.writeFileSync(`${OUT}/marks.json`, JSON.stringify(marks));
// concat list with durations -> CFR 30
let L = ''; for (let i = 0; i < frames.length; i++) { const d = i + 1 < frames.length ? frames[i + 1][1] - frames[i][1] : 0.5; L += `file '${frames[i][0].replace(OUT + '/', '')}'\nduration ${Math.max(d, 0.001).toFixed(4)}\n` }
L += `file '${frames[frames.length - 1][0].replace(OUT + '/', '')}'\n`; fs.writeFileSync(`${OUT}/list.txt`, L);
await b.close(); console.log('frames', frames.length);
