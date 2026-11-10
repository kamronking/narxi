// Narxi Telegram bot — Cloudflare Worker (instant replies via webhook).
// Secrets (Worker → Settings → Variables and Secrets): TG_BOT_TOKEN, FIREBASE_SA (service-account JSON), WEBHOOK_SECRET (any random text).
// After deploying, open once:  https://<your-worker>.workers.dev/setup?key=<WEBHOOK_SECRET>
// Price-drop notifications are still sent by GitHub Actions (scraper/bot.py notify) after every price update.

const SITE = 'https://narxi.site/';
const ORIGIN_OK = o => /^https?:\/\/(www\.)?narxi\.site$/.test(o || '') || o === 'https://kamronking.github.io';
const STORE = { texnomart: 'Texnomart', olcha: 'Olcha', alif: 'Alif Shop', beeline: 'Beeline Market', macbro: 'Macbro', idea: 'Idea',
  maxcom: 'Maxcom', woot: 'Woot', avtech: 'Avtech', mionline: 'Mi Online', tezz: 'Tezz', karcher: 'Kärcher' };
const T = {
  ru: { set: '✅ Слежу за ценой\n\n{name}\nСейчас: {now} сум ({store})\nСообщу, когда будет ≤ {target} сум.',
    phone: 'Чтобы зарегистрироваться в Narxi, нажмите кнопку ниже — Telegram передаст ваш номер. Это необязательно.',
    btn: '📱 Поделиться номером', thanks: '🙏 Спасибо! Номер подтверждён, вы зарегистрированы в Narxi.',
    hello: 'Привет! Я бот Narxi. Откройте товар на сайте и нажмите «Уведомить в Telegram» — я сообщу, когда цена упадёт.\n\n' + SITE,
    list: 'Вы следите за:\n{items}\n\nОтписаться от всего: /stop', empty: 'Пока ничего не отслеживается.', stopped: 'Готово, уведомления отключены.',
    nf: 'Товар не найден — возможно, он больше не продаётся.',
    back: '↩ Вернуться на сайт Narxi', reg: '📱 Регистрация в Narxi\n\nЧтобы завершить регистрацию, нажмите кнопку «📱 Поделиться номером» внизу. Без номера регистрация невозможна.', notOwn: '⚠️ Это не ваш номер. Нажмите кнопку «📱 Поделиться номером» внизу — нужен номер именно вашего Telegram-аккаунта.', needBtn: '👇 Пожалуйста, нажмите кнопку «📱 Поделиться номером» внизу экрана. Номер вручную вводить не нужно — Telegram отправит его сам.', regok: '✅ Готово! Вы зарегистрированы в Narxi. Вернитесь на сайт: ' + SITE },
  uz: { set: "✅ Narxni kuzatyapman\n\n{name}\nHozir: {now} so'm ({store})\nNarx {target} so'm yoki undan past bo'lsa xabar beraman.",
    phone: "Narxi'da ro'yxatdan o'tish uchun pastdagi tugmani bosing — Telegram raqamingizni yuboradi. Bu majburiy emas.",
    btn: '📱 Raqamni yuborish', thanks: "🙏 Rahmat! Raqam tasdiqlandi, siz Narxi'da ro'yxatdan o'tdingiz.",
    hello: "Salom! Men Narxi botiman. Saytda tovarni oching va «Telegram'da xabar berish» tugmasini bosing — narx tushganda yozaman.\n\n" + SITE,
    list: "Kuzatuvdagi tovarlar:\n{items}\n\nHammasini o'chirish: /stop", empty: 'Hozircha hech narsa kuzatilmayapti.', stopped: "Tayyor, xabarlar o'chirildi.",
    nf: 'Tovar topilmadi — balki endi sotilmayapti.',
    back: "↩ Narxi saytiga qaytish", reg: "📱 Narxi'da ro'yxatdan o'tish\n\nRo'yxatdan o'tishni yakunlash uchun pastdagi «📱 Raqamni yuborish» tugmasini bosing. Raqamsiz ro'yxatdan o'tib bo'lmaydi.", notOwn: "⚠️ Bu sizning raqamingiz emas. Pastdagi «📱 Raqamni yuborish» tugmasini bosing — aynan sizning Telegram raqamingiz kerak.", needBtn: "👇 Iltimos, ekran pastidagi «📱 Raqamni yuborish» tugmasini bosing. Raqamni qo'lda yozish shart emas — Telegram o'zi yuboradi.", regok: "✅ Tayyor! Siz Narxi'da ro'yxatdan o'tdingiz. Saytga qayting: " + SITE },
};
const backBtn = (L, id) => ({ inline_keyboard: [[{ text: L.back, url: SITE + '?reg=' + id }]] });
const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k]);
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const pid = k => { let h = 0x811c9dc5; for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 } return h.toString(36) };
const best = p => { const l = p.offers.filter(o => o.stock === 'ok'); return (l.length ? l : p.offers).reduce((a, o) => o.price < a.price ? o : a) };

// ---------- Telegram ----------
async function tg(env, method, body) {
  const r = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.json().catch(() => ({ ok: false }));
}

// ---------- Firestore (REST, service account) ----------
let TOKEN = null, TOKEN_EXP = 0;
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uStr = s => b64u(new TextEncoder().encode(s));
async function gtoken(sa) {
  if (TOKEN && Date.now() < TOKEN_EXP) return TOKEN;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64uStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' +
    b64uStr(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: sa.token_uri, iat: now, exp: now + 3600 }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const r = await fetch(sa.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + unsigned + '.' + b64u(sig) });
  const j = await r.json(); TOKEN = j.access_token; TOKEN_EXP = Date.now() + 50 * 60 * 1000; return TOKEN;
}
const val = v => v === null || v === undefined ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } :
  Number.isInteger(v) ? { integerValue: String(v) } : typeof v === 'number' ? { doubleValue: v } : { stringValue: String(v) };
const unval = f => 'integerValue' in f ? +f.integerValue : 'doubleValue' in f ? f.doubleValue : 'booleanValue' in f ? f.booleanValue : 'nullValue' in f ? null : f.stringValue;
function fs(env) {
  const sa = JSON.parse(env.FIREBASE_SA);
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  const h = async () => ({ authorization: 'Bearer ' + await gtoken(sa), 'content-type': 'application/json' });
  return {
    async set(path, obj, merge = true) {
      const q = merge ? '?' + Object.keys(obj).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&') : '';
      const fields = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, val(v)]));
      return fetch(`${base}/${path}${q}`, { method: 'PATCH', headers: await h(), body: JSON.stringify({ fields }) });
    },
    async get(path) {
      const r = await fetch(`${base}/${path}`, { headers: await h() }); if (!r.ok) return null;
      const d = await r.json(); return Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, unval(v)]));
    },
    async del(path) { return fetch(`${base}/${path}`, { method: 'DELETE', headers: await h() }) },
    async count(col, since) {
      const q = { from: [{ collectionId: col }] };
      if (since) q.where = { fieldFilter: { field: { fieldPath: 'at' }, op: 'GREATER_THAN_OR_EQUAL', value: val(since) } };
      const r = await fetch(`${base}:runAggregationQuery`, { method: 'POST', headers: await h(), body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: q, aggregations: [{ alias: 'n', count: {} }] } }) });
      const j = await r.json(); return +((j[0] && j[0].result && j[0].result.aggregateFields.n.integerValue) || 0);
    },
    async recent(col, n) {
      const r = await fetch(`${base}:runQuery`, { method: 'POST', headers: await h(), body: JSON.stringify({ structuredQuery: { from: [{ collectionId: col }], orderBy: [{ field: { fieldPath: 'at' }, direction: 'DESCENDING' }], limit: n } }) });
      const rows = await r.json();
      return rows.filter(x => x.document).map(x => Object.fromEntries(Object.entries(x.document.fields).map(([k, v]) => [k, unval(v)])));
    },
    async byChat(chat) {
      const r = await fetch(`${base}:runQuery`, { method: 'POST', headers: await h(), body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: 'tg_alerts' }], where: { fieldFilter: { field: { fieldPath: 'chat' }, op: 'EQUAL', value: val(chat) } } } }) });
      const rows = await r.json();
      return rows.filter(x => x.document).map(x => ({ id: x.document.name.split('/').pop(), ...Object.fromEntries(Object.entries(x.document.fields).map(([k, v]) => [k, unval(v)])) }));
    },
  };
}

// ---------- product lookup (data published on the site) ----------
async function findProduct(cat, id) {
  const r = await fetch(`${SITE}data/v2/c/${cat}.json`, { cf: { cacheTtl: 600 } });
  if (!r.ok) return null;
  const ps = await r.json();
  return ps.find(p => pid(p.key) === id) || null;
}

// ---------- update handler ----------
async function handle(env, u) {
  const m = u.message; if (!m || m.chat?.type !== 'private') return;
  const chat = m.chat.id, frm = m.from || {}, db = fs(env);
  // language: chosen on the site (sent in /start payload) > saved for this user > Telegram app language
  const me0 = await db.get(`tg_users/${chat}`);
  const pl = ((m.text || '').match(/^\/start\s+(uz|ru)_/) || [])[1];
  let lang = pl || (me0 && me0.lang) || ((frm.language_code || '').startsWith('uz') ? 'uz' : 'ru'), L = T[lang];
  if (pl && (!me0 || me0.lang !== pl)) await db.set(`tg_users/${chat}`, { lang: pl });
  const text = (m.text || '').trim(), now = Math.floor(Date.now() / 1000);
  const askKb = { keyboard: [[{ text: L.btn, request_contact: true }]], resize_keyboard: true, one_time_keyboard: false, is_persistent: true };
  if (m.contact) {
    if (m.contact.user_id !== frm.id) {  // someone else's contact card — not a verification
      await tg(env, 'sendMessage', { chat_id: chat, text: L.notOwn, reply_markup: askKb }); return;
    }
    {
      const prev = await db.get(`tg_users/${chat}`);
      await db.set(`tg_users/${chat}`, { phone: m.contact.phone_number, first_name: frm.first_name || null, username: frm.username || null, lang, verified_at: now });
      if (prev && prev.site_uid) await db.set(`site_reg/${prev.site_uid}`, { chat, phone: m.contact.phone_number, first_name: frm.first_name || null, at: now });
      if (env.ADMIN_CHAT && !(prev && prev.phone)) {
        await tg(env, 'sendMessage', { chat_id: env.ADMIN_CHAT, text: `🆕 Новый пользователь Narxi\n\n👤 ${frm.first_name || ''} ${frm.last_name || ''}${frm.username ? ' (@' + frm.username + ')' : ''}\n📱 ${m.contact.phone_number}\n🌐 язык: ${lang}${prev && prev.site_uid ? '\n✅ с сайта' : ''}` });
      }
      await tg(env, 'sendMessage', { chat_id: chat, text: prev && prev.site_uid ? L.regok : L.thanks, reply_markup: { remove_keyboard: true } });
      if (prev && prev.site_uid) await tg(env, 'sendMessage', { chat_id: chat, text: '👇', reply_markup: backBtn(L, prev.site_uid) });
    }
    return;
  }
  if (!text.startsWith('/')) {
    const u0 = await db.get(`tg_users/${chat}`);
    if (u0 && u0.site_uid && !u0.phone) { await tg(env, 'sendMessage', { chat_id: chat, text: L.needBtn, reply_markup: askKb }); return; }
  }
  const rg = text.match(/^\/start\s+(?:(?:uz|ru)_)?reg_([A-Za-z0-9]{10,40})$/);
  if (rg) {
    await db.set(`tg_users/${chat}`, { site_uid: rg[1], first_name: frm.first_name || null, username: frm.username || null, lang, seen_at: now });
    const u = await db.get(`tg_users/${chat}`);
    if (u && u.phone) {
      await db.set(`site_reg/${rg[1]}`, { chat, phone: u.phone, first_name: frm.first_name || null, at: now });
      await tg(env, 'sendMessage', { chat_id: chat, text: L.regok, reply_markup: backBtn(L, rg[1]) }); return;
    }
    await tg(env, 'sendMessage', { chat_id: chat, text: L.reg, reply_markup: askKb });
    return;
  }
  const mm = text.match(/^\/start\s+(?:(uz|ru)_)?w([0-9a-z]{1,8})_(\d{1,7})(?:_([a-z0-9-]{2,12}))?$/);
  if (mm) {
    if (mm[1]) { lang = mm[1]; L = T[lang] }
    const id = mm[2], target = +mm[3] * 1000, cat = mm[4];
    const p = cat ? await findProduct(cat, id) : null;
    if (!p) { await tg(env, 'sendMessage', { chat_id: chat, text: L.nf }); return }
    const b = best(p);
    await db.set(`tg_alerts/${chat}_${id}`, { chat, pid: id, key: p.key, name: p.name, target, lang, created: now, last_sent: null }, false);
    const user = await db.get(`tg_users/${chat}`);
    await db.set(`tg_users/${chat}`, { first_name: frm.first_name || null, username: frm.username || null, lang, seen_at: now });
    await tg(env, 'sendMessage', { chat_id: chat, text: fill(L.set, { name: p.name, now: fmt(b.price), store: STORE[b.store] || b.store, target: fmt(target) }) });
    if (!user || !user.phone) await tg(env, 'sendMessage', { chat_id: chat, text: L.phone,
      reply_markup: { keyboard: [[{ text: L.btn, request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
  } else if (text === '/myid') {
    await tg(env, 'sendMessage', { chat_id: chat, text: `Ваш chat id: ${chat}` });
  } else if (text.startsWith('/stats') && env.ADMIN_CHAT && String(chat) === String(env.ADMIN_CHAT)) {
    const day = Math.floor(Date.now() / 1000) - 86400, week = Math.floor(Date.now() / 1000) - 7 * 86400;
    const [all, d1, d7, last] = await Promise.all([db.count('site_reg'), db.count('site_reg', day), db.count('site_reg', week), db.recent('site_reg', 10)]);
    const fmtT = ts => new Date(ts * 1000).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    await tg(env, 'sendMessage', { chat_id: chat, text: `📊 Регистрации Narxi\n\nВсего: ${all}\nЗа 24 часа: ${d1}\nЗа 7 дней: ${d7}\n\nПоследние:\n` + (last.map(r => `• ${fmtT(r.at)} — ${r.first_name || '—'} ${r.phone || ''}`).join('\n') || '—') });
  } else if (text.startsWith('/list')) {
    const al = await db.byChat(chat);
    await tg(env, 'sendMessage', { chat_id: chat, text: al.length ? fill(L.list, { items: al.map(a => `• ${a.name} — ≤ ${fmt(a.target)}`).join('\n') }) : L.empty });
  } else if (text.startsWith('/stop')) {
    for (const a of await db.byChat(chat)) await db.del(`tg_alerts/${a.id}`);
    await tg(env, 'sendMessage', { chat_id: chat, text: L.stopped });
  } else {
    await tg(env, 'sendMessage', { chat_id: chat, text: L.hello });
  }
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === '/setup') {
      if (url.searchParams.get('key') !== env.WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
      const r = await tg(env, 'setWebhook', { url: `${url.origin}/hook`, secret_token: env.WEBHOOK_SECRET, allowed_updates: ['message'], drop_pending_updates: false });
      return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname === '/reg') {  // site asks: is this visitor registered? (yes/no only, no personal data)
      const id = url.searchParams.get('id') || '';
      const d = /^[A-Za-z0-9]{10,40}$/.test(id) ? await fs(env).get(`site_reg/${id}`) : null;
      return new Response(JSON.stringify(d ? { ok: true, name: d.first_name || '' } : { ok: false }), { headers: { 'content-type': 'application/json', 'access-control-allow-origin': ORIGIN_OK(req.headers.get('origin')) ? req.headers.get('origin') : 'https://narxi.site', 'vary': 'origin', 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/hook' && req.method === 'POST') {
      if (req.headers.get('x-telegram-bot-api-secret-token') !== env.WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
      const u = await req.json();
      ctx.waitUntil(handle(env, u).catch(e => console.log('handle error', e && e.stack)));
      return new Response('ok');
    }
    return new Response('Narxi bot');
  },
};
