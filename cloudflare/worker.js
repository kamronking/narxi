// Narxi Telegram bot — Cloudflare Worker (instant replies via webhook).
// Secrets (Worker → Settings → Variables and Secrets): TG_BOT_TOKEN, FIREBASE_SA (service-account JSON), WEBHOOK_SECRET (any random text).
// After deploying, open once:  https://<your-worker>.workers.dev/setup?key=<WEBHOOK_SECRET>
// Price-drop notifications are still sent by GitHub Actions (scraper/bot.py notify) after every price update.

const SITE = 'https://narxi.site/';
const ORIGIN_OK = o => /^https?:\/\/(www\.)?narxi\.site$/.test(o || '') || o === 'https://kamronking.github.io';
const STORE = { texnomart: 'Texnomart', olcha: 'Olcha', alif: 'Alif Shop', beeline: 'Beeline Market', macbro: 'Macbro', idea: 'Idea',
  maxcom: 'Maxcom', woot: 'Woot', avtech: 'Avtech', mionline: 'Mi Online', tezz: 'Tezz', karcher: 'Kärcher', openshop: 'OpenShop' };
const T = {
  ru: { set: '✅ Слежу за ценой\n\n{name}\nСейчас: {now} сум ({store})\nСообщу, когда будет ≤ {target} сум.',
    phone: 'Чтобы зарегистрироваться в Narxi, нажмите кнопку ниже — Telegram передаст ваш номер. Это необязательно.',
    btn: '📱 Поделиться номером', thanks: '🙏 Спасибо! Номер подтверждён, вы зарегистрированы в Narxi.',
    hello: 'Привет! Я бот Narxi. Откройте товар на сайте и нажмите «Уведомить в Telegram» — я сообщу, когда цена упадёт.\n\n' + SITE + '\n📢 Скидки каждый день: @narxi_site',
    list: 'Вы следите за:\n{items}\n\nОтписаться от всего: /stop', empty: 'Пока ничего не отслеживается.', stopped: 'Готово, уведомления отключены.',
    nf: 'Товар не найден — возможно, он больше не продаётся.',
    back: '↩ Вернуться на сайт Narxi', kbHelp: '🆘 Yordam / Поддержка', kbList: '📋 Kuzatuvlarim / Мои товары', kbSite: '🌐 Sayt / Сайт', kbChan: '📢 Kanal / Канал',
    help: "🇺🇿 Savol, narxda xato yoki taklif bormi? Supportga yozing — tez javob beramiz.\n\n🇷🇺 Есть вопрос, ошибка в цене или предложение? Напишите в поддержку — ответим быстро.", helpBtn: '✍️ Supportga yozish / Написать в поддержку', siteTxt: "🇺🇿 13 ta do'kon narxini saytda solishtiring.\n🇷🇺 Сравнивайте цены 13 магазинов на сайте.", siteBtn: '🌐 narxi.site', chanTxt: "🇺🇿 Har kuni ertalab — kunning eng katta narx farqlari.\n🇷🇺 Каждое утро — самые большие разницы в ценах за день.", chanBtn: '📢 @narxi_site', reg: '📱 Регистрация в Narxi\n\nЧтобы завершить регистрацию, нажмите кнопку «📱 Поделиться номером» внизу. Без номера регистрация невозможна.', notOwn: '⚠️ Это не ваш номер. Нажмите кнопку «📱 Поделиться номером» внизу — нужен номер именно вашего Telegram-аккаунта.', needBtn: '👇 Пожалуйста, нажмите кнопку «📱 Поделиться номером» внизу экрана. Номер вручную вводить не нужно — Telegram отправит его сам.', regok: '✅ Готово! Вы зарегистрированы в Narxi. Вернитесь на сайт: ' + SITE },
  uz: { set: "✅ Narxni kuzatyapman\n\n{name}\nHozir: {now} so'm ({store})\nNarx {target} so'm yoki undan past bo'lsa xabar beraman.",
    phone: "Narxi'da ro'yxatdan o'tish uchun pastdagi tugmani bosing — Telegram raqamingizni yuboradi. Bu majburiy emas.",
    btn: '📱 Raqamni yuborish', thanks: "🙏 Rahmat! Raqam tasdiqlandi, siz Narxi'da ro'yxatdan o'tdingiz.",
    hello: "Salom! Men Narxi botiman. Saytda tovarni oching va «Telegram'da xabar berish» tugmasini bosing — narx tushganda yozaman.\n\n" + SITE + "\n📢 Har kuni chegirmalar: @narxi_site",
    list: "Kuzatuvdagi tovarlar:\n{items}\n\nHammasini o'chirish: /stop", empty: 'Hozircha hech narsa kuzatilmayapti.', stopped: "Tayyor, xabarlar o'chirildi.",
    nf: 'Tovar topilmadi — balki endi sotilmayapti.',
    back: "↩ Narxi saytiga qaytish", kbHelp: '🆘 Yordam / Поддержка', kbList: '📋 Kuzatuvlarim / Мои товары', kbSite: '🌐 Sayt / Сайт', kbChan: '📢 Kanal / Канал',
    help: "🇺🇿 Savol, narxda xato yoki taklif bormi? Supportga yozing — tez javob beramiz.\n\n🇷🇺 Есть вопрос, ошибка в цене или предложение? Напишите в поддержку — ответим быстро.", helpBtn: '✍️ Supportga yozish / Написать в поддержку', siteTxt: "🇺🇿 13 ta do'kon narxini saytda solishtiring.\n🇷🇺 Сравнивайте цены 13 магазинов на сайте.", siteBtn: '🌐 narxi.site', chanTxt: "🇺🇿 Har kuni ertalab — kunning eng katta narx farqlari.\n🇷🇺 Каждое утро — самые большие разницы в ценах за день.", chanBtn: '📢 @narxi_site', reg: "📱 Narxi'da ro'yxatdan o'tish\n\nRo'yxatdan o'tishni yakunlash uchun pastdagi «📱 Raqamni yuborish» tugmasini bosing. Raqamsiz ro'yxatdan o'tib bo'lmaydi.", notOwn: "⚠️ Bu sizning raqamingiz emas. Pastdagi «📱 Raqamni yuborish» tugmasini bosing — aynan sizning Telegram raqamingiz kerak.", needBtn: "👇 Iltimos, ekran pastidagi «📱 Raqamni yuborish» tugmasini bosing. Raqamni qo'lda yozish shart emas — Telegram o'zi yuboradi.", regok: "✅ Tayyor! Siz Narxi'da ro'yxatdan o'tdingiz. Saytga qayting: " + SITE },
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
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) { TOKEN = null; TOKEN_EXP = 0; throw new Error('google token failed: ' + JSON.stringify(j).slice(0, 200)) }  // don't cache a failure for 50 min
  TOKEN = j.access_token; TOKEN_EXP = Date.now() + 50 * 60 * 1000; return TOKEN;
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
    async all(col) {
      const r = await fetch(`${base}:runQuery`, { method: 'POST', headers: await h(), body: JSON.stringify({ structuredQuery: { from: [{ collectionId: col }], limit: 2000 } }) });
      const rows = await r.json();
      return rows.filter(x => x.document).map(x => ({ id: x.document.name.split('/').pop(), ...Object.fromEntries(Object.entries(x.document.fields || {}).map(([k, v]) => [k, unval(v)])) }));
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
  const photo = m.photo && m.photo.length ? m.photo[m.photo.length - 1].file_id : null;  // admin broadcast with a picture: photo + caption '/broadcast ...'
  let text = (m.text || m.caption || '').trim(); const now = Math.floor(Date.now() / 1000);
  const askKb = { keyboard: [[{ text: L.btn, request_contact: true }]], resize_keyboard: true, one_time_keyboard: false, is_persistent: true };
  const isAdmin = env.ADMIN_CHAT && String(chat) === String(env.ADMIN_CHAT);
  const userKb = () => ({ keyboard: [[{ text: L.kbList }, { text: L.kbHelp }], [{ text: L.kbSite }, { text: L.kbChan }]], resize_keyboard: true, is_persistent: true });
  const adminKb = { keyboard: [[{ text: '📊 Статистика' }, { text: '👀 Пост: предпросмотр' }], [{ text: '📢 Пост в канал' }, { text: '✉️ Рассылка' }], [{ text: '✅ Отправить рассылку' }, { text: '❌ Отменить рассылку' }]], resize_keyboard: true, is_persistent: true };
  const menuKb = () => isAdmin ? adminKb : userKb();
  // menu buttons are plain text messages: turn them into the matching command
  const BTN = { '📊 Статистика': '/stats', '👀 Пост: предпросмотр': '/post_preview', '📢 Пост в канал': '/post_now', '✉️ Рассылка': '/broadcast', '✅ Отправить рассылку': '/send_broadcast', '❌ Отменить рассылку': '/cancel_broadcast' };
  for (const l of Object.values(T)) { BTN[l.kbHelp] = '/help'; BTN[l.kbList] = '/list'; BTN[l.kbSite] = '/site'; BTN[l.kbChan] = '/channel' }
  if (m.contact) {
    if (m.contact.user_id !== frm.id) {  // someone else's contact card — not a verification
      await tg(env, 'sendMessage', { chat_id: chat, text: L.notOwn, reply_markup: askKb }); return;
    }
    {
      const prev = await db.get(`tg_users/${chat}`);
      await db.set(`tg_users/${chat}`, { phone: m.contact.phone_number, first_name: frm.first_name || null, username: frm.username || null, lang, verified_at: now });
      if (prev && prev.site_uid) { const ex = await db.get(`site_reg/${prev.site_uid}`);
        await db.set(`site_reg/${prev.site_uid}`, { chat, phone: m.contact.phone_number, first_name: frm.first_name || null, at: (ex && ex.at) || now }) }
      if (env.ADMIN_CHAT && !(prev && prev.phone)) {
        await tg(env, 'sendMessage', { chat_id: env.ADMIN_CHAT, text: `🆕 Новый пользователь Narxi\n\n👤 ${frm.first_name || ''} ${frm.last_name || ''}${frm.username ? ' (@' + frm.username + ')' : ''}\n📱 ${m.contact.phone_number}\n🌐 язык: ${lang}${prev && prev.site_uid ? '\n✅ с сайта' : ''}` });
      }
      await tg(env, 'sendMessage', { chat_id: chat, text: prev && prev.site_uid ? L.regok : L.thanks, reply_markup: menuKb() });
      if (prev && prev.site_uid) await tg(env, 'sendMessage', { chat_id: chat, text: '👇', reply_markup: backBtn(L, prev.site_uid) });
    }
    return;
  }
  if (BTN[text] && (BTN[text].startsWith('/help') || BTN[text].startsWith('/list') || BTN[text].startsWith('/site') || BTN[text].startsWith('/channel') || isAdmin)) text = BTN[text];
  if (!text.startsWith('/')) {
    const u0 = await db.get(`tg_users/${chat}`);
    if (u0 && u0.site_uid && !u0.phone) { await tg(env, 'sendMessage', { chat_id: chat, text: L.needBtn, reply_markup: askKb }); return; }
  }
  const rg = text.match(/^\/start\s+(?:(?:uz|ru)_)?reg_([A-Za-z0-9]{10,40})$/);
  if (rg) {
    await db.set(`tg_users/${chat}`, { site_uid: rg[1], first_name: frm.first_name || null, username: frm.username || null, lang, seen_at: now });
    const u = await db.get(`tg_users/${chat}`);
    if (u && u.phone) {
      const ex = await db.get(`site_reg/${rg[1]}`);  // logging in again must not look like a new registration in /stats
      await db.set(`site_reg/${rg[1]}`, { chat, phone: u.phone, first_name: frm.first_name || null, at: (ex && ex.at) || now });
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
  } else if ((text === '/post_preview' || text === '/post_now') && env.ADMIN_CHAT && String(chat) === String(env.ADMIN_CHAT)) {
    // /post_preview -> the morning post sent only to the admin; /post_now -> publish it in the channel right now
    const to = text === '/post_now' ? (env.TG_CHANNEL || CHANNEL) : chat;
    const r = await sendDeals(env, to);
    await tg(env, 'sendMessage', { chat_id: chat, text: r && r.ok ? (text === '/post_now' ? `✅ Опубликовано в ${to}` : 'Это предпросмотр. Опубликовать в канал: /post_now\nКаждое утро в 8:17 пост уходит сам.') : `⚠️ Не получилось: ${(r && r.description) || 'нет ответа'}` });
  } else if (text.startsWith('/stats') && env.ADMIN_CHAT && String(chat) === String(env.ADMIN_CHAT)) {
    const day = Math.floor(Date.now() / 1000) - 86400, week = Math.floor(Date.now() / 1000) - 7 * 86400;
    // one person can register from several devices (phone + laptop) -> count people by phone, first time seen
    const regs = await db.all('site_reg'), first = {};
    for (const r of regs) { const k = r.phone || r.chat || r.id; if (!first[k] || (r.at || 0) < first[k].at) first[k] = { ...r, at: r.at || 0 } }
    const ppl = Object.values(first), last = ppl.slice().sort((a, b) => b.at - a.at).slice(0, 10);
    const d1 = ppl.filter(r => r.at >= day).length, d7 = ppl.filter(r => r.at >= week).length;
    const fmtT = ts => new Date(ts * 1000).toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    await tg(env, 'sendMessage', { chat_id: chat, text: `📊 Регистрации Narxi\n\nЛюдей: ${ppl.length} (входов с устройств: ${regs.length})\nНовых за 24 часа: ${d1}\nНовых за 7 дней: ${d7}\n\nПоследние:\n` + (last.map(r => `• ${fmtT(r.at)} — ${r.first_name || '—'} ${r.phone || ''}`).join('\n') || '—') });
  } else if ((text.startsWith('/broadcast') || text === '/send_broadcast' || text === '/cancel_broadcast') && env.ADMIN_CHAT && String(chat) === String(env.ADMIN_CHAT)) {
    // admin-only mass message: /broadcast <text> -> preview; /send_broadcast -> send to everyone; /cancel_broadcast -> drop
    if (text === '/cancel_broadcast') { await db.del('bot/broadcast'); await tg(env, 'sendMessage', { chat_id: chat, text: 'Рассылка отменена.' }); return }
    if (text.startsWith('/broadcast')) {
      const body = text.replace(/^\/broadcast(@\w+)?\s*/, '').trim();
      if (!body) { await tg(env, 'sendMessage', { chat_id: chat, text: 'Напишите так:\n/broadcast Текст сообщения\n\nС картинкой: отправьте фото и в подписи к нему напишите /broadcast Текст' }); return }
      const users = await db.all('tg_users');
      if (photo && body.length > 1024) { await tg(env, 'sendMessage', { chat_id: chat, text: `Подпись к фото слишком длинная: ${body.length} символов, Telegram разрешает 1024. Сократите текст.` }); return }
      await db.set('bot/broadcast', { text: body, photo: photo || '', at: Math.floor(Date.now() / 1000) }, false);
      await tg(env, 'sendMessage', { chat_id: chat, text: `👀 Предпросмотр рассылки (получат ${users.length} чел.):` });
      if (photo) await tg(env, 'sendPhoto', { chat_id: chat, photo, caption: body }); else await tg(env, 'sendMessage', { chat_id: chat, text: body, disable_web_page_preview: false });
      await tg(env, 'sendMessage', { chat_id: chat, text: 'Отправить всем? Нажмите /send_broadcast\nОтменить: /cancel_broadcast' });
      return;
    }
    const bc = await db.get('bot/broadcast');
    if (!bc || !bc.text) { await tg(env, 'sendMessage', { chat_id: chat, text: 'Нет подготовленной рассылки. Сначала /broadcast Текст' }); return }
    // Workers free plan allows ~50 outgoing requests per message, so send in parts of 35 and remember where we stopped
    const all = (await db.all('tg_users')).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const from = +bc.done || 0, part = all.slice(from, from + 35);
    let ok = +bc.ok || 0, fail = +bc.fail || 0;
    for (const u of part) {
      const r = bc.photo ? await tg(env, 'sendPhoto', { chat_id: u.id, photo: bc.photo, caption: bc.text }) : await tg(env, 'sendMessage', { chat_id: u.id, text: bc.text });
      (r && r.ok) ? ok++ : fail++;
    }
    const done = from + part.length;
    if (done < all.length) {
      await db.set('bot/broadcast', { done, ok, fail });
      await tg(env, 'sendMessage', { chat_id: chat, text: `⏳ Отправлено ${done} из ${all.length}. Нажмите /send_broadcast ещё раз, чтобы продолжить.` });
      return;
    }
    await db.del('bot/broadcast');
    await tg(env, 'sendMessage', { chat_id: chat, text: `✅ Рассылка отправлена: ${ok}\n❌ Не доставлено: ${fail} (заблокировали бота)` });
  } else if ((text === '/plan' || text === '/plan_evening') && isAdmin) {
    await planReminder(env, text === '/plan_evening');
  } else if (text === '/admin' && isAdmin) {
    await tg(env, 'setMyCommands', { commands: [{ command: 'start', description: 'Boshlash / Начать' }, { command: 'help', description: 'Yordam / Поддержка' }, { command: 'list', description: 'Kuzatuvlarim / Мои отслеживания' }, { command: 'stop', description: "Xabarlarni o'chirish / Отключить уведомления" }] });
    await tg(env, 'setMyCommands', { scope: { type: 'chat', chat_id: chat }, commands: [{ command: 'admin', description: 'Панель админа' }, { command: 'stats', description: 'Статистика' }, { command: 'post_preview', description: 'Пост: предпросмотр' }, { command: 'post_now', description: 'Пост в канал' }, { command: 'broadcast', description: 'Рассылка' }, { command: 'help', description: 'Поддержка' }] });
    await tg(env, 'sendMessage', { chat_id: chat, text: '🛠 Панель админа. Кнопки внизу:\n📊 Статистика — регистрации\n👀 / 📢 — утренний пост: посмотреть или опубликовать\n✉️ Рассылка — как отправить сообщение всем\n✅ / ❌ — отправить или отменить подготовленную рассылку', reply_markup: adminKb });
  } else if (text.startsWith('/help')) {
    await tg(env, 'sendMessage', { chat_id: chat, text: L.help, reply_markup: { inline_keyboard: [[{ text: L.helpBtn, url: 'https://t.me/narx_support' }]] } });
  } else if (text.startsWith('/site')) {
    await tg(env, 'sendMessage', { chat_id: chat, text: L.siteTxt, reply_markup: { inline_keyboard: [[{ text: L.siteBtn, url: SITE + '?utm_source=tg_bot' }]] } });
  } else if (text.startsWith('/channel')) {
    await tg(env, 'sendMessage', { chat_id: chat, text: L.chanTxt, reply_markup: { inline_keyboard: [[{ text: L.chanBtn, url: 'https://t.me/narxi_site' }]] } });
  } else if (text.startsWith('/list')) {
    const al = await db.byChat(chat);
    await tg(env, 'sendMessage', { chat_id: chat, text: al.length ? fill(L.list, { items: al.map(a => `• ${a.name} — ≤ ${fmt(a.target)}`).join('\n') }) : L.empty });
  } else if (text.startsWith('/stop')) {
    for (const a of await db.byChat(chat)) await db.del(`tg_alerts/${a.id}`);
    await tg(env, 'sendMessage', { chat_id: chat, text: L.stopped });
  } else {
    await tg(env, 'sendMessage', { chat_id: chat, text: L.hello, reply_markup: menuKb() });
  }
}

// ---------- daily deals post to the Telegram channel ----------
// Every morning (~08:17 Tashkent, the 03:17 UTC run of the cron below) the bot posts the top-5 price gaps to the channel.
// The bot must be an admin of the channel with "Post messages". Channel name: variable TG_CHANNEL (e.g. @narxi_uz) or CHANNEL below.
const CHANNEL = '@narxi_site';
const MON = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const mlnS = n => (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '').replace('.', ',') + ' mln';
async function dealsPost() {
  const r = await fetch(SITE + 'data/v2/meta.json?t=' + Date.now(), { cf: { cacheTtl: 0 } });
  const m = await r.json();
  const rows = [];
  for (const p of m.deals || []) {
    const ok = p.offers.filter(o => o.stock === 'ok' && o.price > 0);
    if (ok.length < 2 || p.cat === 'printers' || p.cat === 'other') continue;   // keep it to things most people buy
    const lo = ok.reduce((a, o) => o.price < a.price ? o : a), hi = ok.reduce((a, o) => o.price > a.price ? o : a);
    const gap = hi.price - lo.price;
    if (gap <= 0 || gap >= hi.price * .3 || lo.store === hi.store || lo.price > 30e6) continue;   // >30% is usually a different model, not a deal
    rows.push({ p, lo, hi, gap, n: ok.length, fam: p.name.toLowerCase().split(/\s+/).slice(0, 3).join(' ') });
  }
  rows.sort((a, b) => b.gap - a.gap);
  const pick = [], fams = new Set(), cats = {};
  for (const x of rows) {
    if (fams.has(x.fam) || (cats[x.p.cat] || 0) >= 2) continue;   // no 5 sizes of one iPhone, max 2 per category
    fams.add(x.fam); cats[x.p.cat] = (cats[x.p.cat] || 0) + 1; pick.push(x);
    if (pick.length === 5) break;
  }
  if (!pick.length) return null;
  const d = new Date(Date.now() + 5 * 3600e3);
  const num = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
  const items = pick.map((x, i) => `${num[i]} <b>${esc(x.p.name.replace(/^[А-Яа-яЁё\s-]+(?=[A-Z0-9])/, ''))}</b>
✅ ${fmt(x.lo.price)} so'm — ${esc(STORE[x.lo.store] || x.lo.store)}
❌ ${fmt(x.hi.price)} so'm — ${esc(STORE[x.hi.store] || x.hi.store)}
💰 Farq: <b>${mlnS(x.gap)} so'm</b> · <a href="${SITE}?p=${encodeURIComponent(x.p.key)}&utm_source=tg_channel">${x.n} do'kon narxi →</a>`).join('\n\n');
  const text = `🔥 <b>Bugun qayerda arzon?</b> · ${d.getUTCDate()}-${MON[d.getUTCMonth()]}

Bitta tovar — turli do'konda turli narx. Bugungi eng katta farqlar:

${items}

🔎 13 do'kon narxlari har 3 soatda yangilanadi: <a href="${SITE}?utm_source=tg_channel">narxi.site</a>
#narxlar #chegirma`;
  const img = pick[0].p.img ? `https://images.weserv.nl/?url=${encodeURIComponent(pick[0].p.img)}&w=800&h=800&fit=contain&cbg=white&output=jpg` : null;
  return { text, img };
}
async function sendDeals(env, chat) {
  const post = await dealsPost();
  if (!post) return { ok: false, description: 'no deals' };
  const body = { chat_id: chat, text: post.text, parse_mode: 'HTML' };
  body.link_preview_options = post.img ? { url: post.img, prefer_large_media: true, show_above_text: true } : { is_disabled: true };
  let r = await tg(env, 'sendMessage', body);
  if (r && !r.ok && post.img) { body.link_preview_options = { is_disabled: true }; r = await tg(env, 'sendMessage', body) }
  return r;
}
async function morningPost(env) {
  const ch = env.TG_CHANNEL || CHANNEL;
  const r = await sendDeals(env, ch);
  if ((!r || !r.ok) && env.ADMIN_CHAT) await tg(env, 'sendMessage', { chat_id: env.ADMIN_CHAT, text: `⚠️ Утренний пост в ${ch} не отправился: ${(r && r.description) || 'нет ответа'}.\nПроверьте, что бот — админ канала с правом публиковать.` });
}


// ---------- personal plan reminders for the admin (Kamron) ----------
const PLAN_URL = 'https://plan.narxi.site/';
const PLAN = [
 ['Первые деньги',['Портфолио: постер, меню, сайт-визитка + Narxi','Прайс: постер 50–150 тыс., меню 100–250 тыс., сайт 1–3 млн','Обойти 15 бизнесов в Гулистане с примерами','Первый платный заказ (постер или меню) до 30 ноября','1 млн сум дохода до 31 декабря','Отзыв и фото работы от каждого клиента','Первый сайт за деньги до 31 января; 3 клиента в Ташкенте','5 млн сум в месяц к июлю 2027']],
 ['Narxi: деньги',['Проверка «настоящая скидка» к 27 ноября','Написать 5 магазинам про партнёрку 2–3%','Первая партнёрская ссылка до 31 декабря','Страницы товаров для Google','Считать переходы в магазины каждую неделю','10 продаж через Narxi в месяц к марту 2027','100 продаж в месяц к концу 2027','Питч для инвестора, 10 слайдов']],
 ['Аудитория',['3 рилса в неделю','1 уличный опрос в неделю','Отвечать на все «+» в течение 2 часов','1 000 подписчиков канала до 31 декабря','5 000 в Instagram до 31 марта 2027','10 000 в Instagram до 30 июня 2027','1 коллаборация с блогером в месяц','Разбор статистики каждое воскресенье']],
 ['Продажи и общение',['Скрипт продажи дизайна и сайтов: написать и выучить','10 холодных сообщений в неделю','Записывать каждое «нет» и причину','Питч Narxi за 60 секунд: каждый день','Переговоры с 1 магазином в неделю','1 книга о продажах в месяц','Рассказать о Narxi на 1 мероприятии','Найти ментора-предпринимателя']],
 ['Финансы',['Записывать все доходы и расходы каждый день','Откладывать 20% с каждого дохода','Отдельная карта для денег проекта','Не брать кредиты на покупки','Отчёт месяца: заработал / отложил','Подушка на 3 месяца к концу 2027','Пройти курс по основам инвестиций','Первая инвестиция после подушки']],
 ['Навыки',['Английский 30 мин в день','IELTS 6.5 к концу 2027','Код Narxi: 30 мин в день','Дизайн: 1 работа в день (Canva / Figma)','1 книга или курс по маркетингу в месяц','Разбирать 1 успешный стартап в неделю','Автоматизировать 1 задачу с ИИ в месяц','1 видео-монолог на камеру в неделю']],
 ['Окружение и семья',['Показывать родителям 1 результат в месяц','Подарок родителям с первого дохода','3 знакомых предпринимателя в Ташкенте','1 бизнес-мероприятие в месяц','Заявка в акселератор (IT Park и др.) в 2027','Дневник прогресса в Telegram раз в неделю','1 вечер в неделю с теми, кто растёт','Помочь 1 человеку бесплатно в месяц']],
 ['Здоровье и режим',['Сон 7–8 часов, подъём в одно время','Спорт 3 раза в неделю по 30 мин','План дня вечером накануне','6 часов работы блоками по 90 мин','Без соцсетей до обеда (кроме работы)','Разбор недели в воскресенье, 30 мин','Без фастфуда 5 дней в неделю','1 день полного отдыха в неделю']]
];
function planTasks(day) {
  // 3 different directions each day, rotating; actions advance week by week
  const out = [];
  for (let j = 0; j < 3; j++) { const d = (day * 3 + j) % 8; const a = (Math.floor(day / 3) + j) % 8; out.push(`• ${PLAN[d][0]}: ${PLAN[d][1][a]}`) }
  return out.join('\n');
}
async function planReminder(env, evening) {
  if (!env.ADMIN_CHAT) return;
  const day = Math.floor((Date.now() + 5 * 3600e3) / 864e5);
  const text = evening
    ? '🌙 Вечер. Отметь в плане, что сделал сегодня — зелёные клетки = видимый результат.\nЗавтра утром напиши Claude «утро».'
    : `☀️ Доброе утро! Цель: 1 000 000 $ к 25 годам.\n\n3 задачи на сегодня:\n${planTasks(day)}\n\nХочешь задачи под твой прогресс — напиши Claude «утро».`;
  await tg(env, 'sendMessage', { chat_id: env.ADMIN_CHAT, text, reply_markup: { inline_keyboard: [[{ text: '📋 Открыть план', url: PLAN_URL }]] } });
}

// ---------- price robot timer ----------
// GitHub often skips its own scheduled runs, so Cloudflare's cron (Settings → Triggers → Cron: 17 */3 * * *) starts the
// "collect prices" workflow. Needs secret GH_TOKEN: fine-grained GitHub token, repo kamronking/narxi only, Actions: Read and write.
async function startScraper(env) {
  if (!env.GH_TOKEN) { console.log('GH_TOKEN not set, robot not started'); return }
  const r = await fetch('https://api.github.com/repos/kamronking/narxi/actions/workflows/scrape.yml/dispatches', {
    method: 'POST', body: JSON.stringify({ ref: 'main' }),
    headers: { authorization: 'Bearer ' + env.GH_TOKEN, accept: 'application/vnd.github+json', 'user-agent': 'narxi-bot', 'content-type': 'application/json' } });
  console.log('start robot:', r.status, r.status === 204 ? 'ok' : await r.text());
  if (r.status !== 204 && env.ADMIN_CHAT) await tg(env, 'sendMessage', { chat_id: env.ADMIN_CHAT, text: `⚠️ Робот цен не запустился (GitHub ответил ${r.status}). Возможно, истёк GH_TOKEN.` });
}

// ---------- plan.narxi.site (PIN-encrypted personal plan, static) ----------
const PLAN_ASSETS = {"/index.html": ["text/html", "PCFkb2N0eXBlIGh0bWw+PGh0bWwgbGFuZz0icnUiPjxoZWFkPjxtZXRhIGNoYXJzZXQ9InV0Zi04Ij48bWV0YSBuYW1lPSJ2aWV3cG9ydCIgY29udGVudD0id2lkdGg9ZGV2aWNlLXdpZHRoLGluaXRpYWwtc2NhbGU9MSx2aWV3cG9ydC1maXQ9Y292ZXIiPgo8bWV0YSBuYW1lPSJyb2JvdHMiIGNvbnRlbnQ9Im5vaW5kZXgsbm9mb2xsb3ciPjxtZXRhIG5hbWU9ImFwcGxlLW1vYmlsZS13ZWItYXBwLWNhcGFibGUiIGNvbnRlbnQ9InllcyI+PG1ldGEgbmFtZT0ibW9iaWxlLXdlYi1hcHAtY2FwYWJsZSIgY29udGVudD0ieWVzIj4KPG1ldGEgbmFtZT0iYXBwbGUtbW9iaWxlLXdlYi1hcHAtc3RhdHVzLWJhci1zdHlsZSIgY29udGVudD0iYmxhY2stdHJhbnNsdWNlbnQiPjxtZXRhIG5hbWU9ImFwcGxlLW1vYmlsZS13ZWItYXBwLXRpdGxlIiBjb250ZW50PSLQnNC40LvQu9C40L7QvSI+PG1ldGEgbmFtZT0idGhlbWUtY29sb3IiIGNvbnRlbnQ9IiMxNzcwNGYiPgo8bGluayByZWw9Im1hbmlmZXN0IiBocmVmPSJtYW5pZmVzdC53ZWJtYW5pZmVzdCI+PGxpbmsgcmVsPSJhcHBsZS10b3VjaC1pY29uIiBocmVmPSJpY29uLTE4MC5wbmciPgo8c3R5bGU+OnJvb3R7cGFkZGluZy10b3A6ZW52KHNhZmUtYXJlYS1pbnNldC10b3AsMHB4KTtwYWRkaW5nLWJvdHRvbTplbnYoc2FmZS1hcmVhLWluc2V0LWJvdHRvbSwwcHgpfWJvZHl7bWFyZ2luOjB9PC9zdHlsZT48dGl0bGU+0JzQvtC5INC/0LvQsNC9PC90aXRsZT4KPGxpbmsgcmVsPSJwcmVjb25uZWN0IiBocmVmPSJodHRwczovL2ZvbnRzLmdvb2dsZWFwaXMuY29tIj4KPGxpbmsgcmVsPSJzdHlsZXNoZWV0IiBocmVmPSJodHRwczovL2ZvbnRzLmdvb2dsZWFwaXMuY29tL2NzczI/ZmFtaWx5PVVuYm91bmRlZDp3Z2h0QDYwMDs4MDAmZmFtaWx5PU9uZXN0OndnaHRANDAwOzUwMDs2MDA7NzAwJmRpc3BsYXk9c3dhcCI+CjxzdHlsZT4KLyogTGF5b3V0OiBwaG9uZS1maXJzdCBjb2x1bW4g4oCUIHRvZGF5J3MgMyB0YXNrcyBvbiB0b3AsIHRoZSBnb2FsLCB0aGVuIG5pbmUgM3gzIGJsb2NrcyBzdGFja2VkIChjZW50cmFsIGJsb2NrIGZpcnN0KSAqLwo6cm9vdHsKICAtLWJnOiNlZWYxZWQ7IC0tY2FyZDojZmZmZmZmOyAtLWZnOiMxNDFhMTc7IC0tbXV0ZWQ6IzVhNjY1ZjsgLS1saW5lOiNkNWRjZDY7CiAgLS1hY2NlbnQ6IzE3NzA0ZjsgLS1hY2NlbnQtc29mdDojZTJmMmVhOyAtLWRvbmU6IzE3NzA0ZjsgLS1kb25lLWZnOiNmZmZmZmY7IC0taGk6I2M4ZjE2OTsgLS1oaS1mZzojMTQxYTE3OwogIC0tZGlzcGxheTonVW5ib3VuZGVkJywnT25lc3QnLHN5c3RlbS11aSxzYW5zLXNlcmlmOyAtLWJvZHk6J09uZXN0JyxzeXN0ZW0tdWksc2Fucy1zZXJpZjsKfQpAbWVkaWEgKHByZWZlcnMtY29sb3Itc2NoZW1lOiBkYXJrKXs6cm9vdDpub3QoW2RhdGEtdGhlbWU9ImxpZ2h0Il0pey0tYmc6IzBmMTQxMjstLWNhcmQ6IzE4MjAxYzstLWZnOiNlOGVlZTk7LS1tdXRlZDojOWZiMGE2Oy0tbGluZTojMmIzNjMxOy0tYWNjZW50OiM1ZmM0OWI7LS1hY2NlbnQtc29mdDojMWQzMzI5Oy0tZG9uZTojMmY4ZjY4Oy0tZG9uZS1mZzojZmZmZmZmOy0taGk6I2M4ZjE2OTstLWhpLWZnOiMxNDFhMTc7Y29sb3Itc2NoZW1lOmRhcmt9fQo6cm9vdFtkYXRhLXRoZW1lPSJkYXJrIl17LS1iZzojMGYxNDEyOy0tY2FyZDojMTgyMDFjOy0tZmc6I2U4ZWVlOTstLW11dGVkOiM5ZmIwYTY7LS1saW5lOiMyYjM2MzE7LS1hY2NlbnQ6IzVmYzQ5YjstLWFjY2VudC1zb2Z0OiMxZDMzMjk7LS1kb25lOiMyZjhmNjg7LS1kb25lLWZnOiNmZmZmZmY7LS1oaTojYzhmMTY5Oy0taGktZmc6IzE0MWExNztjb2xvci1zY2hlbWU6ZGFya30KKntib3gtc2l6aW5nOmJvcmRlci1ib3h9CmJvZHl7YmFja2dyb3VuZDp2YXIoLS1iZyk7Y29sb3I6dmFyKC0tZmcpO2ZvbnQtZmFtaWx5OnZhcigtLWJvZHkpO2ZvbnQtc2l6ZToxNXB4O2xpbmUtaGVpZ2h0OjEuNDU7cGFkZGluZy1sZWZ0Om1heCgxNnB4LGVudihzYWZlLWFyZWEtaW5zZXQtbGVmdCwwcHgpKTtwYWRkaW5nLXJpZ2h0Om1heCgxNnB4LGVudihzYWZlLWFyZWEtaW5zZXQtcmlnaHQsMHB4KSk7cGFkZGluZy1ibG9jazoxOHB4IDQ4cHh9Ci53cmFwe21heC13aWR0aDo1NjBweDttYXJnaW46MCBhdXRvO2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjIycHh9Cmgxe2ZvbnQtZmFtaWx5OnZhcigtLWRpc3BsYXkpO2ZvbnQtd2VpZ2h0OjgwMDtmb250LXNpemU6Y2xhbXAoMjRweCw2LjV2dywzMnB4KTtsZXR0ZXItc3BhY2luZzotLjVweDttYXJnaW46MDtsaW5lLWhlaWdodDoxLjE7dGV4dC13cmFwOmJhbGFuY2V9Cmgye2ZvbnQtZmFtaWx5OnZhcigtLWRpc3BsYXkpO2ZvbnQtd2VpZ2h0OjYwMDtmb250LXNpemU6MTVweDtsZXR0ZXItc3BhY2luZzouM3B4O21hcmdpbjowfQouZXllYnJvd3tmb250LXNpemU6MTJweDtmb250LXdlaWdodDo3MDA7bGV0dGVyLXNwYWNpbmc6MS40cHg7dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2NvbG9yOnZhcigtLWFjY2VudCl9Ci50b2RheXtiYWNrZ3JvdW5kOnZhcigtLWNhcmQpO2JvcmRlcjoxLjVweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItcmFkaXVzOjIycHg7cGFkZGluZzoxOHB4O2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjEwcHh9Ci50YXNre2Rpc3BsYXk6ZmxleDtnYXA6MTJweDthbGlnbi1pdGVtczpmbGV4LXN0YXJ0O3BhZGRpbmc6MTJweDtib3JkZXItcmFkaXVzOjE0cHg7YmFja2dyb3VuZDp2YXIoLS1iZyk7Y3Vyc29yOnBvaW50ZXI7Ym9yZGVyOjEuNXB4IHNvbGlkIHRyYW5zcGFyZW50fQoudGFzayBpbnB1dHt3aWR0aDoyNHB4O2hlaWdodDoyNHB4O2ZsZXg6bm9uZTthY2NlbnQtY29sb3I6dmFyKC0tZG9uZSk7bWFyZ2luOjFweCAwIDB9Ci50YXNrIC50e2ZvbnQtd2VpZ2h0OjYwMH0KLnRhc2sgLm17Zm9udC1zaXplOjEzcHg7Y29sb3I6dmFyKC0tbXV0ZWQpO21hcmdpbi10b3A6MnB4fQoudGFzay5vbiAudHt0ZXh0LWRlY29yYXRpb246bGluZS10aHJvdWdoO2NvbG9yOnZhcigtLW11dGVkKX0KLmdvYWx7YmFja2dyb3VuZDp2YXIoLS1hY2NlbnQpO2NvbG9yOiNmZmY7Ym9yZGVyLXJhZGl1czoyMnB4O3BhZGRpbmc6MjBweH0KLmdvYWwgLmV5ZWJyb3d7Y29sb3I6dmFyKC0taGkpfQouZ29hbCBwe21hcmdpbjo4cHggMCAwO2ZvbnQtZmFtaWx5OnZhcigtLWRpc3BsYXkpO2ZvbnQtd2VpZ2h0OjYwMDtmb250LXNpemU6Y2xhbXAoMTdweCw0LjZ2dywyMXB4KTtsaW5lLWhlaWdodDoxLjN9Ci5wcm9ne2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEwcHg7bWFyZ2luLXRvcDoxNHB4O2ZvbnQtc2l6ZToxM3B4O2ZvbnQtd2VpZ2h0OjYwMH0KLnByb2cgLmJhcntmbGV4OjE7aGVpZ2h0OjhweDtib3JkZXItcmFkaXVzOjk5cHg7YmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LC4yNSk7b3ZlcmZsb3c6aGlkZGVufQoucHJvZyAuYmFyIGl7ZGlzcGxheTpibG9jaztoZWlnaHQ6MTAwJTtiYWNrZ3JvdW5kOnZhcigtLWhpKTtib3JkZXItcmFkaXVzOjk5cHh9Ci5ibG9ja3tkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2dhcDo4cHh9Ci5iaHtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6YmFzZWxpbmU7Z2FwOjhweH0KLmJoIHNwYW57Zm9udC1zaXplOjEzcHg7Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtd2VpZ2h0OjYwMDtmb250LXZhcmlhbnQtbnVtZXJpYzp0YWJ1bGFyLW51bXN9Ci5ncmlke2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDMsbWlubWF4KDAsMWZyKSk7Z2FwOjZweH0KLmNlbGx7bWluLWhlaWdodDo5NnB4O2JvcmRlci1yYWRpdXM6MTRweDtiYWNrZ3JvdW5kOnZhcigtLWNhcmQpO2JvcmRlcjoxLjVweCBzb2xpZCB2YXIoLS1saW5lKTtwYWRkaW5nOjhweDtmb250LXNpemU6MTIuNXB4O2xpbmUtaGVpZ2h0OjEuMztmb250LXdlaWdodDo1MDA7Y29sb3I6dmFyKC0tZmcpO3RleHQtYWxpZ246bGVmdDtmb250LWZhbWlseTp2YXIoLS1ib2R5KTtjdXJzb3I6cG9pbnRlcjtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2dhcDo0cHg7bWluLXdpZHRoOjA7d29yZC1icmVhazpicmVhay13b3JkfQouY2VsbCAuY2t7Zm9udC1zaXplOjExcHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOnZhcigtLW11dGVkKX0KLmNlbGwub257YmFja2dyb3VuZDp2YXIoLS1kb25lKTtjb2xvcjp2YXIoLS1kb25lLWZnKTtib3JkZXItY29sb3I6dmFyKC0tZG9uZSl9Ci5jZWxsLm9uIC5ja3tjb2xvcjp2YXIoLS1kb25lLWZnKX0KLmNlbGwubWlke2JhY2tncm91bmQ6dmFyKC0tYWNjZW50LXNvZnQpO2JvcmRlci1jb2xvcjp2YXIoLS1hY2NlbnQpO2ZvbnQtZmFtaWx5OnZhcigtLWRpc3BsYXkpO2ZvbnQtd2VpZ2h0OjYwMDtmb250LXNpemU6MTJweDtjdXJzb3I6ZGVmYXVsdDtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO3RleHQtYWxpZ246Y2VudGVyfQouY2VsbC5jb3Jle2JhY2tncm91bmQ6dmFyKC0tYWNjZW50KTtjb2xvcjojZmZmO2JvcmRlci1jb2xvcjp2YXIoLS1hY2NlbnQpfQouY2VsbC5kaXJ7YmFja2dyb3VuZDp2YXIoLS1hY2NlbnQtc29mdCk7Ym9yZGVyLWNvbG9yOnZhcigtLWxpbmUpO2ZvbnQtd2VpZ2h0OjcwMDtjdXJzb3I6cG9pbnRlcn0KYnV0dG9uOmZvY3VzLXZpc2libGUsbGFiZWw6Zm9jdXMtd2l0aGlue291dGxpbmU6M3B4IHNvbGlkIHZhcigtLWhpKTtvdXRsaW5lLW9mZnNldDoycHh9Ci5oaW50e2ZvbnQtc2l6ZToxM3B4O2NvbG9yOnZhcigtLW11dGVkKTttYXJnaW46MH0KLnJlc2V0e2FsaWduLXNlbGY6ZmxleC1zdGFydDtib3JkZXI6MS41cHggc29saWQgdmFyKC0tbGluZSk7YmFja2dyb3VuZDp2YXIoLS1jYXJkKTtjb2xvcjp2YXIoLS1tdXRlZCk7Ym9yZGVyLXJhZGl1czoxMnB4O3BhZGRpbmc6MTBweCAxNHB4O2ZvbnQ6NjAwIDEzcHggdmFyKC0tYm9keSk7Y3Vyc29yOnBvaW50ZXJ9CkBtZWRpYSAobWF4LXdpZHRoOjM2MHB4KXsuY2VsbHtmb250LXNpemU6MTEuNXB4O21pbi1oZWlnaHQ6MTA0cHh9fQo8L3N0eWxlPgoKPGRpdiBpZD0ibG9jayI+PGRpdiBjbGFzcz0ibGsiPjxkaXYgY2xhc3M9ImxpYyI+MU08L2Rpdj48ZGl2IGNsYXNzPSJleWVicm93Ij7Qm9C40YfQvdGL0Lkg0L/Qu9Cw0L08L2Rpdj48aDEgc3R5bGU9ImZvbnQtc2l6ZToyNHB4Ij7QktCy0LXQtNC4IFBJTi3QutC+0LQ8L2gxPgo8ZGl2IGNsYXNzPSJkb3RzIiBpZD0iZG90cyI+PGk+PC9pPjxpPjwvaT48aT48L2k+PGk+PC9pPjwvZGl2PjxwIGNsYXNzPSJoaW50IiBpZD0ibG1zZyI+Jm5ic3A7PC9wPgo8ZGl2IGNsYXNzPSJwYWQiIGlkPSJwYWQiPjwvZGl2PjwvZGl2PjwvZGl2Pgo8c3R5bGU+I2xvY2t7bWluLWhlaWdodDo4MHZoO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcn0ubGt7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEycHg7dGV4dC1hbGlnbjpjZW50ZXI7d2lkdGg6MTAwJTttYXgtd2lkdGg6MzAwcHh9Ci5saWN7d2lkdGg6NjRweDtoZWlnaHQ6NjRweDtib3JkZXItcmFkaXVzOjE4cHg7YmFja2dyb3VuZDojMTc3MDRmO2NvbG9yOiNjOGYxNjk7Zm9udDo4MDAgMjRweCB2YXIoLS1kaXNwbGF5KTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXJ9Ci5kb3Rze2Rpc3BsYXk6ZmxleDtnYXA6MTZweDttYXJnaW46NnB4IDB9LmRvdHMgaXt3aWR0aDoxNnB4O2hlaWdodDoxNnB4O2JvcmRlci1yYWRpdXM6NTAlO2JvcmRlcjoycHggc29saWQgdmFyKC0tYWNjZW50KX0uZG90cyBpLmZ7YmFja2dyb3VuZDp2YXIoLS1hY2NlbnQpfS5kb3RzLmVycnthbmltYXRpb246c2ggLjM1c30KQGtleWZyYW1lcyBzaHsyNSV7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLThweCl9NzUle3RyYW5zZm9ybTp0cmFuc2xhdGVYKDhweCl9fQoucGFke2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDMsMWZyKTtnYXA6MTJweDt3aWR0aDoxMDAlfS5wYWQgYnV0dG9ue2hlaWdodDo2NHB4O2JvcmRlci1yYWRpdXM6NTAlO2FzcGVjdC1yYXRpbzoxO2p1c3RpZnktc2VsZjpjZW50ZXI7Ym9yZGVyOjEuNXB4IHNvbGlkIHZhcigtLWxpbmUpO2JhY2tncm91bmQ6dmFyKC0tY2FyZCk7Y29sb3I6dmFyKC0tZmcpO2ZvbnQ6NjAwIDI0cHggdmFyKC0tYm9keSk7Y3Vyc29yOnBvaW50ZXJ9LnBhZCBidXR0b246YWN0aXZle2JhY2tncm91bmQ6dmFyKC0tYWNjZW50LXNvZnQpfS5wYWQgLnh7Ym9yZGVyOm5vbmU7YmFja2dyb3VuZDpub25lO2ZvbnQtc2l6ZToxNnB4fQoubG9ja2J0bnthbGlnbi1zZWxmOmZsZXgtc3RhcnQ7Ym9yZGVyOjEuNXB4IHNvbGlkIHZhcigtLWxpbmUpO2JhY2tncm91bmQ6dmFyKC0tY2FyZCk7Y29sb3I6dmFyKC0tbXV0ZWQpO2JvcmRlci1yYWRpdXM6MTJweDtwYWRkaW5nOjEwcHggMTRweDtmb250OjYwMCAxM3B4IHZhcigtLWJvZHkpO2N1cnNvcjpwb2ludGVyfTwvc3R5bGU+CjxzY3JpcHQ+CmNvbnN0IFA9e3M6IjRyeUpMSHFqT2JjZVAvVGRXVHVaSWc9PSIsaToiZ1FDQis3T1c2Y3RuUlhSSyIsYzoieXlCR1dibnIvK3NNcXkyQXlSQkd0NWpJaTdndW83c0l0NGdJL3Z0alJXaEFMR0pRd254Z2lBQTZ2eUtCUDNBSGFXaHd0WjI5YkU4N1BlbmVBOUROaTkrMHVCQWNZM1c4TFdYR1VubURmc2NOc1h5d2I2Z0hZVC9ndXU2bEs2UFMvS2FES1VWKzNKckwrWUU2SDdmWnRqNEw1MDgwdS9BUkhwSHdLblpUcVRDd2ZSbEtDY0RhbVJONjhvdzVHcnJWNGJlaitoLys0UFlKNGRBa2FGMDRleFZweFJRR0R3TTg3ei8rZVhTRnJCY1hkTDduM3RwR3hmTGVVa1FPM1EzNHY5OWJKQzZQdGozOCtla3dVTXlNdnRXVDNnOHhZWWxMLzlvZzRmdTM0S3BNU0Q4QzVPRExIbzBFT0hvdXRGZ1p1NGhPT0pIZXI0SXZYOFBBdmYzV283MS9pQStDSFR4YWVmNkcvZm13TFRtd1MvOXlsaVU5ZUtqa3NZdFdYNTdUOGxDMkFWNnNUNk9DVlFadGNPRzBxVlVrZFhSUnNpZFlsRW11Y0dpc1NXaHVkVXRPb2lvbE9EVGVJZ2hRcnEzVzVpNk9lbFo5OEM0K2prMkh3eVFkbXEydjZ2R1h5eER2dE00VGRwSklOcXdvNTRhSFNGZGthRjFoV1FBZk5wTzhZa0lmNzRRdEY1SzhkMGw5UkRTSFhyb1ZsZDFKSGp0ZVdTek5wWmh3b3djd2p3UExnRDM3bkRXaVkzTTFCaDBrQVB5ZnJHWXl3eFZFaXBqQmRTNkFHK3hZUnAxcVVnVWwwVVZ5aGpTRFFFbWplV1lPNWhhYjhSdkNuVlhRUUg3RUNRRnQwa0lKUG5Xbm9zRGxhd29wWWExZ2IwN1hTbVRxT3NZTXBEdE45MXhwZGd2bUVJMFFFL3pBMWdyWkJ3cmRtMU9zYWN5dExrZ3lQZUl2N25nVkh6bmx2bkxjVEI0cEZQVE9PdjhVVm4zN2RaTEFHNEhibkdSODRpNktVUGlUSEhTSjJQUmg1bmtkRVVmaFZTTFlmVjgwd0RhODFBejNrSG9MNFRURExQTjlheDdVSE9URVFMVFM3V21xTS92SVFVditvZ1BPMkEzbXBGODdaRXJobzNLY0dwMmtqTFptWmxrM1ZFTTNndWFtNVRnZUR3dGpKRmM0bUFDTk42TEs3Y2I3MlBVRHVQTngyZ0JSam5qNGVkMmVLYXR1UzVSUVRtRjNVTzNiSy9zMXNGSUx4NW5qYlh2ekgwMXZTSzM0d0FFOFkrVTYvaGtnZU1DZmc4LzZGcGJBaVpIVWtvZFFCWThGL3drV1Bia3FqVzdRaXlMSDJiWlZBQ1F4UVR4VFRrT1BwVm5sdVFpSmNVb3B1dEQzaHNyU0Z6aXE4Z2FRUkppa3VaN2tlU2liVlZtT1lXKy9VcDBIdjdFWG41cWx1Znp6c2VrM29hWHl6Z3czbHQvV3RtdGRYZkRNenpGZkFJUm1IVGdSQXdLVitlU0tpTTEvZk9nWUpLSUlUd21tWmR0eUV4YUdmL3pXUmJWeDVwOS9iU2dCQUdMTXdydUxkaXBneDRrZ3I3bHFSNnhkWTExU1lFSVBLZkprN050THBUZ3dZcDA1MzRVb2NWSXZGby9aQ1Q3TWpUUzRCTm95ekJtUVN2cndvdjQzL1lVVnIvQThKWVpzeENEZFBqMzBEYWhUd3RrM1RwczlrbEZIdXk0bGJ0Z2FSQm9paE5ZN0QwT3JRa0ZWNjJEOXc4dXBxQnR5ZWNWK1BJL2Y3dC9FbTNRQ2h0aTQ0b3VGS1czSWxWeFU3U1RDRkY2NDA1WVlNN0p6WlI1RUx4ZUFJNytZMTR3Y05kbmJXVTRDTFVZRFVvWC9Eb1o1ZnJOTFVUU3pqVkFCYUt1bDNYaDJtWW1YZ2d0eEEvSVU0S3VSbFdFZFFCeEtEOG5xRzlWd2oxWlk1MVZCcUJBTmFRVisxU09NeTUxVUViMjNwRUp0YXBwWmZSYm5TcFV2ZE9ZMndvWnFOOUl5YmZDVmFIODVFYkxpWkRobytmZnQ3aWRpbTBFYkJLNmpjR3ZxRmY4SXlncElSeG9sbUsrUWZxYVpxWGFJRVdINzdwbnJKWS9MSUhNNURRNVp6cVI1NGtSbXNzaExHNmRmdEtjbW1wbCt3SWcrcFlreW5SVW1XeGRpNUZhTVJFSXdIN0xqZWdHRlhjNXRVNkl0WStHSzdyVXdyU0dmU2kwME9QNnd0L3I0REc1d3NWK3FHM0M1cUMyZGp6L3E2SDFsTUoxM290Z01DazZwMDBJanF0dGpDUVVyYnRRbzRLaWJEbkRXSHVMSlh5UlVsdWVjdGV0bjVaOCtCSjRxdzVvY20wZHRLREgrK25VZGxxb3ZNemdXdDZYRnliSzlQRTc5ekFoSy9iVWNHbkNzZldxdGhHazViRTMvT0dXeXM0RkVJWWlqSWx0LytqTGU4OXRYQTVYSWxVZVlSRU5aNXdwYitMbk1pVGk0eWZRRnhtQzZlK2ZPcDZmS0Z1WEU5VGM3VkJSVmt2SzNoTUtIRWVlVHBRbWlaZFhDUnlNMTJTbnRTV0JjMmpEQVdJS3IrbmQxWnEvSENhRUVKUW9WYmJGTVpWbVFGWDNyUW5zbThoQTBwak5MQytZT0tuMk9MTkhjdFJKZTFscjZvNjJOUisvQXdtcVlvZlZXbzE0VFNoU3FNQmZpZWxONnl1eG51WldNc0hOeTZUZW1lckdxNHlJWmpsSU93QkNzbVlTVFRCaGtqRktETGtpTGtBemZHQWRFTy9hSXhLb2xsWWJOZVJ0aExDMlVtcGtER3AxV2Z6enZ3KytyeUJTdERLVEhjTTZJMXNZR0Q2MkYrWkcvcitXL1VlZlNSMWhWVHhhRnRVWVdvK0ZWTjdXS2l0VGljaUpLZVNOanh2OTQxSVlid2lVUlAxQXRZZksvNEd1aXVVQ1RpdVVITmEvODgwNEtRV3VJT1g3dWc0c3h1VkVhSHdlQVBSdUFFSVp6Z2ZiWHRadTJVVmRZSEswbjczNzBJTU5talY4WmE4Sy9DNFdHM1BRR2NHcWxGdFJMZDFMcmNSUnh3elZiV1FVR3Z5SGNiNlcybFlHSmlhL3BDNmZYUXBzeEw3LzBhd1NyVXFIZHVuckJ3amxPSXdwUHorQ2FNYit4c21JVVRHRU4wNWI0TDNoNmh4MUVwWUJ6aU1ydGlvaDB6clNWcmMxb1o4N3gwWlQwbDNhTnJCeTVXNmRuWjdVRmdpWTRhbGQ2dG5OL0p5RHBHVFRLSHVVK0h3ZkdTcGVnWTBQYnZEWVpsc2thVzhKQXUxcVZ0RlJmY3c0RmhqeUphcmJlYUo3ZmFYdFd6VS9CM1NkTHdZVlZHamZPeWFGUmZFL0MyQnptZ1hjN0c4VkR1bjdCN0x0TjhPZHZnSVkrbVErUUtXUlArUFRhWXRTTkdrdmdyQk9ta2YyTUwwQnpUMGh0R3QyVUEvVEk1T0VhYnNxaEMxeENUTE1PempsN0RlZFQ1OGorUkd1ZVNhUy9lek43a05QUndUQ09wekE4Q09IQ3l3VzN2RTJlNGdTK2NnZmNiYWhhSmYyY3Azek95ZGtEaHVNQkdISHYrOEhGdm9JL3JtOTR6QUJJV0djZ1k4cmRGREd0cDRKQXdaVlU1QTZNY25rTUZhYUtCYkp2ZTNQL0dURHdFZzlWSkFOTWtQNm9RZ1JHT2VBZWQ2cnp6MmJoV3A4VDI1QTBEMTNjSXc3bjRnUmVQcGg5U0p0R0IxYkpmRHgxR3dsT1lpRHVYb1hTU3F3cm5icTR2OWM5MkV6ZUNsVDNWRzBvQ0wrQ2hSZ0kxeS9VRXNZWVNhV24wSXl2TGtob1lnNHphdUNUOEF1bVVkUEc3R04zVlpEcGNpZDhRci9OcFlKT3NXZnIxWnIydkdoMGJ5dmJOaHNEK3huS1Zzek5SSy9Cam9ueGMzcWEyRDA1WnJzWFdhM3VPRURNMXdjaG1wcEpmTHFMdEVSVnNiTll4UEVwMDU4U2RUMkRCdjRTUkFiQVdJdHQ3MThveEM4clZ0ZjNXbzBpVDR4aEJTNnNzQzhKTlVpeFR1VFdxYTBLN0dGMW0rblJrNzczZWE1YmVBTjN1dDJqK3FrV2dOS2s0VDliN0ZTckdrSFBPbWZOanFwclN2SU9yOTgxMmNCdHc4TURRQ1pJb0ZGS0xqbXN0WXdsVkE5a1RiYzVxYVZ2ejlCRFBlWXY0VkxlbFFBRGFDNzRSYmtGc0hURklPVEVza3pYZitFaXBEeERCM0k2SzlRb3Nuenp3T01TMmhxREVFN1FtcStvek1XV2J1dittMUxmdCtVZzB0T0psTEFueWYydkwxWjdsSWlQYXNFMVRsbEVCbFcyOVNJYjN4aHczY0lpSDVsY0pobmxtQ3QxbURnRW43eU5RNDI0VEgwaDJ6WS9SYk5WRW5XMm5EZXNnUUdGZm5GVXdDWGt6eTAzdkpkUU5va2dxbmUvL01nRldRU1ZWK0pQVUxTcnptWVVCcnNxemNIeVZId1V4aGZDM3djWFJwL1VRY2JOY0ZTTEU2OE10ejI3WHJGd0RCMDYrcVVQeGQ3endaZ1dNSGxER09kL2xYUExxTWliVDZneDY4MmlDaEJlM29iazlJVUF1UXNEcTRIdHpSa0J0SHI5MGxVMFpHWThWOEhTWEtPdXlOT05yR2hpL1pMeldEVGJyRWRQazN4aFlHNVRJczArMzROdmlYRTFObGtFUElIdVFLZkQwVlhSdGp1MEpjeEMrVjM4L1NZTTM2U0lvUnlIVUtwQ0EvZlAxQkhRczByZTdtR3l2aXpYS2F2cXRySHdLdGdwRUFETnh3ZEVXc1dwZ0xheVFjdTFscjcwYkkzdFBodXZnMFhUT1pPWGdmMUtOb0ZaYXYzOElzM1AwbzRZeTZpUVhWbmFWRnRLdEJEQUNwRVRIeSt6MVVEV01vL1UvWC9NaVhkelZtL2RsOVFSbkRwSmRQaWljRFBtNFZGWHZEWjJBbGRFbUFQQ25tMjFTY3J4cGE1RGk1VWhJVDlzZVk2R3ZUR1d2MHl3bm1QK1grMDdaVXFLWWZJUzMya1JBckxFbUR1aXZxM0lpV1ZKN1o5SGQyVXV0YjB3Zi96YXkrNUdkYmlLaThJSGxCb3E4WVlZYSttRzJaT0VyQVF6RTF6cnFjeWZpWExneUNMdHVZZENSSHNGN1cvMG52bmVJK3FOeVZ2Y2RJdWY1R3h6WDBBU3FZNE9kNitEQkZqZmtxSXBTaFZORGdhUmZzRkxJNW13RjZvVEJiRlhJajJvenl6dGpQSjlMN2VNYmk5TTNHUVRjc0hHQ245dkhMSG1DMzB4SFlJa1EwcWxrNzk1ZzhhWkpGR0x1YmFrNjVLTFZnZTUwcnN6SW1KN0xLTW5BRGRwbXpjQkFwUDNydktRWGwxeFlGOGNWcUZnUTgrR2RISTcwYVpEZitrUGFMTEUwckgwRHBTQnM3b25yM2Y2TzNMcDZKRkNJaitaSEF6b2NzNThnN3dtcUlFUW9VSms5elExU1JWYi8xMTVwYm1rRExqQVczRlpPSDhIQTdFSEp5OVFNcWdoa2tRSTBCNWYxSGJiTVNuVllhTmd6bm5KMDN5L0tEam9GNkFZQmxWUVdYYnBEakhSSmduMWlWdmNHdXNtNkFFdTdUMWZlWk95RVV5TkdDbkJwRHlJYm5xMm9tMkw0MEJQZkh4b09tUGZQRFVYbk56cFpicjUrbDZKTWxIV0lsVDI0VzRwb0FaU2dHTVgxb1lrN0xvdDhpSnFTTmc5NU90WXJZWkk2ZW5YMmYwcDcyb1RNcE1YcERqOE1ZUlJTdnVEUVpqYWFZS0NyQWM1dXhrZHlteVFpSURyYWxlVDVaaGg0eitjUFc3YmdCV1pvZnFuQlI0NXZTUmVDUFAyOGhYS1VzZGlWeW9RZGwyNzd1T281Q014UU9ucnlIU3ArVUpkUld5dTVKV0NwNVdseXVSWlpNWEF5TU14N1pJVVhycU9iR2JXZE1yZlRtSGhSRnpBazdzM2laOUJWODBlL0xpbGZGbEd4U0tEajNEMEVoOVd6ZmlGOHBrdmtOSlRQZzlZYjBBSTNqOUZ0OEU1NE1ORFUrSERGRjVHWnBnMm9hd0ovMk81aC9Zb2lxYURkODlqZ3loNy9rZENZbyttcnBuMGRSTE1SWk1ydWN4MkVRVFFDcndvL3FLUDZ6N1RFZkRXcm1RSnVpaVhydTR3bDVrS2hJaGVPME5TaW40N0VzWVlBWVYvOHR1emxGOU5zc3hYaWZFaWs0Yi9lRmdDcW9HbVZvaXJjU0NqMzlPVjZLTFFiUnhubUpZQSt1MXFqZnJSUW9uRnN6SlJlbjQyR2tyZTB6TWFIVEgxTU1FVjJlT0cvNUVEdlJ5UGQvbFk3MzhSb2lzY0pJK05Hb3VCQW9ha2tCUHpBZFBJbmQzRWZwaHFrd1VTbUJleUx5UlJBeVlSd1N2cVN5ZndWM09wam9DNVlLQ09DdThZL0xYd0NlQmxuRjlkeXdvbkdXaFFqa3FENzhZaDBEMHZ3TDBURkoyQzRTNUlYT1NLRGZlbmlqS0FNT25HQTlkVjJReWNQNzhwTjR6VjZkZUtTaFhvczZYMDc5MnBzcC9uRytHazBSbC91bThjSTNBZ2JsUFBmek16TkczU1B0Rmg2Nks0dDhHRjVobDVmbE80bHdVcldpbWVqcUxtR1ZIUHVSc2hNTllJSHpnZjIvbUJ4TmU3LzlCMXVMS2FwVjNTWTFYL2szS3B0Wlp4bzdUNFdXOFI1dE9LMlg3Q1lPL2xpdWZENjhCbkJpa3FRSE0rNHY5dW1CZC9RRDdpMGxoM2g5SHNqRkdLT3o2T0JlUUhUdnZYa1oyNWsrejFOMk5yWHNQaFNwbzU4amQ0cVlJdTl1dlRaSk5WbFRLVWU2ZC9RUWZkRTRXUStINDJ4eXIxYmdURG5sY0tBVUR5aTFpdk1aKzFXQVcyRDlWaHBlVWllR1hZMm01TnpQTmNBQmNQNmZPbE50RVR4MmtRRGFGQlNQRmEvc1FnSkkxeHFmMFFGMmdkV1cxODFhYXVYOGRNQndSN0N1SDZuK0NGektXUlJKN3MxWUtmMXpWZTF0a1hVTXBNdFNrRlIyeXE4REttdGd3ZjZESHp5TzNFbTdZandHVm1JaGswWDhrdmxYNFdubVdYamxjVEd1YTZpYVlTa05admY1YU1RMzFZZXZMY2pVRlZYdmpZSDJtc21hM01FSVpRUXh3eVVOVGpSRVFFUVdQZHNDdmhURTRiMmszRlp6UTI3UE5aeEUxMmRZSHlKaGwzWTlndUR5RmlIR0I2S0RQeWJPRmY3a2VuN3JCanh0OHkvV3ppZ3JKM3NzZUNwM0Z4VnVTYjJvVDF1djNrbVlpcXRkeWx0U2FaS1A2TGw4V1k4U2kyUS9QcTdaNVAxZ0pZRXBzK0lHRTA1ZE5kcWEvTE9IRStWZ2cwb041ais5ZG0vRnVGdTBFNmJMdHlJS3p1ZUZVYTlEMTIzM1hBWmcrclhjMGUwcHVkOXROZ1dnbHRCTkIvVWlqRFBCcHZja29SR0NZMWE3UWxMeHJJaVBiMllaRGszTm5pSGJLK24vUFJXOHY4c2xqK2t0OTV4YUFHL2FjTEhkODkxcGlpT0kyblZFMGUxempFeGNldDE1eEx6QnlMbENZOFpXczJpL29xSFJ5VGtIS3hEenlpY3h1d2oyRWJibnVYbDgwVlBTajMwYXVhUmcrRWRCL1E1TG1CdlNRcmx0ZkIyTzZaUWpWSFNpTHA3bC8yTWhob1psQi9nUGxrbVF0ZEp6MFFvYm9IUEZMdis1bjdhcEt4QTExTEp4a3hZcVFkN294dC9MVjhrTVlZSStMMGdGMjBRL2cwNHF4U2N2VGtPcnR2Vmo2QmxlMlFvNm8zejdjbzRhZnluQTJ0eW4wQmxQV3ZMT0h4ajlWeE1vVi9RTmhodlVUc3pKMDg5ZWpPTk9NRWxJZW5IN1h4NjdFMGU1aFVOeE4zOFYvNTB6UnowUDdnWUVhaktqSy8xZ3F2dmNqK3lVdEFUYUJ4T0JmelhKbnBxcnVIRURJSVZyZXQwSU45Rmpob05DeUVrY0tJanVjMTR6bTNoN1VqTnFvaE1Xcjk3N1BzQ0RhcTZnQmFiSjFackk4SlBXU1N6d05YNDJiWjV4eElqVjN4N3BnWmdnalA1aVVwZ1dyUWU0TE1QVFUxbGEvcVdtR3YyZ2NBYXY0T3hITVBzcG12OEd0MmdFMDJZLyttZGlMVUdJbHRod1l4bDBGNk5uanlqckFsZHMycjZyTzZHQ3dFMlZ6UkFCNEZrZUNVaFByN3pNdUdscWVUQkhHeUZnTjU0dnFsKzhqb3hmcWx2QXVDMzV0WXBmMUEyUkxpNWVkWWdIY2RueXBrdXlMTGIwQ2RLY05EUWorTFpvUHV1UWpCLzRqYUxqWDJXL0RkZ3IrSE8ybTZEZnB2VVgyOE9tdkJML2JwMWpnYk5DcXZKL09vVy9ncTFtZjE4WEhYVnlySUVTSjVNNC9FNTdnN0dIYWJ4dCtkR2l6M1ZsNjJ2UktLbldyZG04V1lIdXR3N1NTWnRSdnZPOTJBUFRqaUx0SmM5eHp6VnlWWHB2cnVxK0h0SEt3YTFHTjV4cER2QlVYcjNvdXYxeTlwL0JBQkJYM1V5S0EzZUFyTzhleUVPQzRVY09NNy8yNTJiaVZCbFovNFJUSzhQRllSd3JrdVNMQnhNTUx1TGZDNksvdEJiL0VZeXJjeDRHQW5RTEhMMUp6VVlRM0M4WlBvYlkwL0lYdGhXRHA3SjZIMnhpUGg5RVdBQ3dXTkxsYWRwWVdiaWQ3bjQ0dXkwdlVxM2p0cmRHNUVmYmxwR1J1SUFkbVJYK21lS0E1SG11OFpzZ2dHMEN4ZFlnZTdTNHBReUt0TnpSeng0SUJ5Zk5jbDhrRjZwTDQxTVhUSG0yQjFhM1lqdnkyOXF6ajZ6Wks3Sy94cjRqUjBmMXErd1lSQjBCSUtZZW1icDVVQzVzUFcyUkVneCtaVVladysxUlg5d3M1MDNvekR6ZUM5L2JWUGdrZzE2b1dHZXI1V2tWd3RpYk1XcFN2ZVVqVHhJTjd4WVRhQWlXV3p6dkhBRkREQjZoSG5HNm44eThhSlBZVlNHS2pnRVM2cExOd0xFaFJPQ3M5ekJRMG9UamYrTlp4N3R1YXZUaXVIUzBXckJtdHBldTcwelJTUWYxcVVGME1ZZHEzTlVlRDdwZWd4N3lYclozczFlbUY0UmhyN1ZsVjREWW9hUjNmVWFvTFJsODBaNWRWL1YzTXJ1TkVWRGI5bWFrdGFiN05HbE1ySnBqOERwdGk4Ry91dDRxVlBvTFRQRzBqMkoyWE1keDRVVmsyK0w5c1hadTZGdzdNK3ZINlNBbDVHTFAwcE9UcUhCaGhLakt4SGl3U09Qd1JtdlJKdzdLZTF4L2RQNHlSMFlTREpqazRCZ05qaCt0ZGx4aXhiL3hpcXdhcCt0SkM2aXVKZ2VYU0RvOWs0YnJ6dGlERnE0K3lCbE56MExsRVJLVlR1cVRoek5CUDdaaTZEUkV5cS93eEo3a0tIVVJUZ29QRmx0Y3pqR1pnRXdNaTBhQ0Z1RVNTQUlJNmN2UEhYSGN3bHFwWVVVWlUrU3lEWklpbUVPVjZ4bEsyYXE4RGhZemVVdnRYR2VmYzNFN3dPdng2a2VVVUFISWJjRXVCeldyazNHYXRyL0xOdWgzL0dQWDZKUTVKay9pM2RLVFN1L09na3R0ZU9WZUhSUTJLcVhSZzByZlI2Skp4bGR6SFBXTmJRUHFuZWtQTFQ2cUlKSGpjb0Nnb3AxOGZoTTVEWnczY0FHb3cweENsTG5QajRzMWZZN3ZuazRyWGlEcWUrRk1XazJSMFpYRTN2aW1XaGZHc1A0aS90eEpPVEtHS3ptc25LSGRMcFJHVWNlQ0MvbUIzOG1oZzBLSHA5bVRtYzhnbXdFZlVBVml6RzVpVDNzYW9kVVhEYWw2Y0Z1eXZsbWozaC93WUFYcnVrM2x6amR2YjRKTjBXZGVvNDFTMWVyczRINGNSSWpRR3hUL1ZqVEIrbTB1bk9MZ0plZ1NPSVR4UldWVXdicHNCS2Y5Z0VuQ0JRSHRvY2pBY2YxSDA0Q2ZEa0VzZHcreitZNkRIT3VZOWtVZ3dYTzJhZ1lWMkdCeFowZno0M3NIakpaRG9Uck9nOEtWcCs1STB2OGU3N28rKytPbTBxMHZFREdXaHg2SUd6ZDRpMlJtZStDdU9KZmdnOURTVW9tTWQ1Q1FjbVljT1g0eFhLWWcrR3lLenppTnl0SzhFTCtXUlZHZ1BYYkxQYUU2aXRqWTJEY2dneDZRL2wwY3RPRCtYSDV0VjBvY2JNeFFFZWI4NHB4OWw4YXkzRkxPeVEvY2c5TXRDYUFVMjZCbDJ3RUxYZTFhQkhuSXJFcjVjU0RFSkxoY0VuMFBWMkRXbTRhelZHeUxCbFNKV1RMcnlUTFhCdmFFS0tMMkIrY3lIS1pqTDRlQnYwVWdoVUJCQzdEdFpBcDhhcWRveDZKZHRQTTdZVUpPdy9WZmdNb2R1WmVpN2RPeXhlRnQvSlYrbXVaRVJLWnpLMWNha0tlU3lxNWZzSDFodkdzNVJ2a3cvOHpmeGJlekVTanZJWE9uYUtHOUNxNTN3eTFyeDEyVVB5MGlsUi9vWmQwSnVKUmIrWEthQXFVS3JNVGlQYWtDdDQvdzIzNzBocURJSlVmYTBGd1Vmc3p6TldWYVFXS1pvbDFzcXlKcEc5V1krUFhuZTdiSFo5OTdieGZvdlZORmtOWkdsUWdJTUlmOFk2UGt3NEdSaFVaNE9PSlRtTi9iRjNRS05VWDVzSDk2bUhIRlZaUlJ1VUZmTnFtL0ZJT2VLWU5WaThYS1NhcDRUVTU0cXBiK0FzcWJYRk02R3lsUDE5R2doMGlxS25TMDJtdTQ5ZmlScW5NckJMMFdIaFZIZDhRc1BxYnk5UXViRCt0SldNZVdNd09qZXhHdVZpYzY3Vi92SzNXYVhRZkNMejc3VE9ZU2VycmJDTGVYbVNKUUwyMkFsaE8wT2dVeFBmckxJR2ZVcDYyL0VGZjJ6dTh1K2VwWkh5eXRpQ1kvMEJNcjdzc3E2ZEs2YTdtMlUza1ZJQndJTjJMejY2ZVNDZHo1UGNZQ2I1blFzMVBGbDZrSXJ0RkY1SkJpcGN4TVMrV2k1NW9LdnpPZFNBTXM3Z0k4ekpMMngxa052ZHR5cDhxb2dLeU56V1ZlYmcyYjBIeHB6UnlxU1NhQ3IrS3dBZEJVeG95VDVqRitOdWxzamd0SWtEaUF3akhwdWwzRDFKUmVmMExWMFh2aEtkaDNMQzd4eWVURFRHRGxLR1J3cHdESHMyMk9vMWdXRitISWRudTl1SUNpQ1h5b08rU0sxUUZTdjhMNThRR2wzL05UeXQ5ZW9ieFA1aTh5QUlkdkpobzNhelpvUVVNNmRtYkVkN0dBeWdMemVadFdOaXdkalgySnlXZ1VFdlJVUzFtZjFUN2ZyMW5HdWpQL1hmQ25UK3VCZGZtcDhySmZXTjhod1JKTHl0UlVtMjZDY3pVeU52dzNOOGE4MkVwM2swYkZjbG05Q2J2WXlXRGM0aEVUdTBCT1ZvMjRmUjRYc2tVZHRlemJHODJZWk5Mb1RpR3NYaDBsQlBGTGtoRHZhTVRWdXU2dEJJM3lzZVUwNlRTS0k1N0RMemhYclpZeXJhVGFaVVdHNmlKVEpPamtxaGtudU1zM2UvejliT1Q5Nm1nd1FWOFdKTnlqRmVZTG55TThieVcrUEw4N2g5OUJzQURWZ1VtbHUzZjduTFF4TkhtcTZZK3BLY2hvWmZ0bU1jMHNOaXgvNllVLzhXMFNIVDlWVFpQdW1qeTF3eCtKZk1qaTk0WGJkMXdpVDZ2czc1S0lFYXEzRGZ1bjduZWhrVmRoR0pncWwwV2x4RXhWR1BxTVpPRVVaNkFZOGFLSTllZ1RPaVJYT2lQNjBjSGRQY29WR0paUms5NDQ3UVpGazVQQkxzdWZZTXBUM05wVTgyRnpYYUM0K1R1NTBqcWlHNnlwa3JSSGdBSHh1RG5Db3gyNmthOVpIWHhFOXEvVE9OcHBpVHNrdGVzdUZQUDFYekJvY3BKL29iRytsaUNGYnI4RTVHME1EMlo4Ym5lT0ZKT1VYK2RRTU4rcjIxZFZaOStnQUNydlkxTFM5dG1SdTM4czZ0c1oyckg4UHFkZ0tod0x3RitSZlBmcTY4QVpZQThtdmlCUVlQRkl0QWo3eVhza2ZlSzV3Z3VyY0pWNnp6WmNoVzAxNU5RYnJyNDJ2SW9ucmFpckN5V2dLWGZlRmhOekdjWWgraVhrbWUxeHF6Q2IwNVFSVnd1bURsNGhUWFFNRkRkeGRZQVl5UGc4eTlLRTd1K3p1K1Q0Rnk1czlLWVM3MDhLcnlpZ0xDRnV5MFZITkRib1FNZXNILzlHcXEySHpPL2ZRVjFwL0REenpsUUdsbXhwRk1DL1djOVRhNzdEMEFhMHF3NVB1WUQyM1FCOUtGTjl3ZGNxL3c2aHN6TVpDSFN1YTJERi9LbnVzTVMwMDh0NldSQm9oN3ZFYmZ2aE10RTVqYU9BUWQ3Nmc3V29qMlhNeHArU25ISTlsNkl0bnFtZTJxVDU3OFBVZlZKck9DQUJJczRPc2pjKzVHTEc3akQ4SFlSMHM3SE01ZzhUemJnSFRHTCthVlJMbktQdjZ5a0REMlEvUHpnV2xva3Y1VEJSSEltckV6ekVoRkZjK2V1eWtSUll5Y3pJU3BrQ1UzUUNJTklUODNNbC9wRmF5OE1KVnRyNUJCci94dXMvVC90MStNdXBhSmtMZFBlS0M5RzFwdWxZcXk3Nm5wQkpLM1BsN3paM01ScC9EOE8wQjl6SGlJcXU2N290ZHlZMXB0SEhoYmhSMEJZSm9oUktwUHBta0Q4ZFFabmtXRnMycGVpTnFsUU1PaEVNeFBzWngvdUNxUjlNRDErcGZVR25vYWlQYUdMYS9FTHcwbUlVWDV4T01MNFAyNVg2aXU1eDNRVmFqa1VFWDA2SEJBMTRHZERsSEVHb1pacXdRcHQzN0dkeE11aERZTnhicG92dzlxZzVqNUcvbkVLUmhJT3VWelRHVm9Ub3k5SU1ra09uSmdOOHZpRlh4R2ljWDFPSkxsa1RGaHZQTnN1eEFXUG5jR2dWTXc4dEtCaG5GQkZ1UkhNM1VKTVczWTB2MThWdHRtenlaZi9jdGM1QzFVNVB4Nzg0ejRSdVpjcUEwWlhOMjNmUWxyZVRtS2FUTkI2VjJ1dUd5UXV0ZDQ1VngvOTVjdTdrZXZIdWlwVlFRcGVjMEtVVXV0eUVSVTlIWm5YRUhXSTg4Mkl5MDBkQnppcFVZVzd2dGJQZGtLMjhqdjVBQWdsbXhMN04xNWVTdzQ3dVduY0k3YjE5QkFKWHdCUHZseHg4L2tjZGNDSVdEdTYwS21lZHNNU21ZK1VhZ2ZiSXFtd0FwMEhmdXB5NEtjamg3MkwrT0N4anE0bGpFWG9BeWE2TXdrSHZrZ2s0N05pcFZabVYvU0pFa09ZYit3V3dLcGJRVTdhOWtpQ3pBeFVQeG81UkpXMG5OU1lFWG5LRVR3YjFRUjd1T2t0bTY0dFhDWWlwSEo5Z0tNOFZwemt6c3UxRHlvUUp3ZkJxL01DeFBLRWdUdlBGdzZxVWNFKzR4NkoyWkR3cElQOStQMmZxWW1VNG5rR3VSRHN4c28xSmZIOGJxWWFtL1E0ZVZkTTJiclk1SHhIMWRITDBnTjcvalQ5cGNEVHI5dERFbXpMUXl6NWZpTS84Vnl2UnQ1ZzJoT25YOW4zbzFVTGx1S1ZvRVlTemw2ZWs5NGFENCt4NnFoSTJ0cHhaQ2VocEREUXhqN2pEZmxPck1jV3pZc1JCVjF4Smlrc0hUVS81cUFJQTNpZUV6STNGMVp3Smx4V2hiOFg0OWpPTW5ta1A2NnkybjgwL3Niek9iT3JQRDhPeGoyNGpKMU9lazhRWWs0dmZjdkFhMnNkUG9HUG1GTk9LT2ErU2xyYWtUSzQ0dTNmSWU3bXFNZHdVQWthVVlnQVQ1K1lxVzNGT0M3bTFHcXB2MUpWWTlCejRROUFTN3R3ZW1FSGZLL2Y4Y0xLTVgvREI4T2xGbDFsU0YxU215N3hvbUZhdEtXNE5qZUd4SGlPTTZaWTJyajRCNXQzRnQ5Q3FyYjZ6SWpsZXplQWd2d0NRZEVrVW9EZWxhbExRdWhRb21JRXR3c0x5czZGNnp6dTZ3ODlkMUo0R1RoMVY3V1dSZklyQlhwNUxtbWc5SDRsbHB3YU1UUVRmeE0rVGk4bEZ3QWZ4VWRvUEU1bzZKVndnNGZTREltKzVYOFZRenovVnBkYU9yOTcrSmphVksyUzhNNUtDUHk3VU1QTWdMbG9GZ2t4NDhPWnZ3cjBYbGJoZUFzWGdFYVF4VURpRGdrQUFXWDZTbThKSm9pME56dXZXK1ROSTVPUGlGc3NtNWh4bUxmYjlFRDBYdVp6K3d2N2doY09rNDk4b1Z2bTMrdElwdlJKUEN3a0RwOTZUcmFjVWdobkRhWm4yRmpGOW16YjdpV2RycUVjWHQ0c016dTlEYWE2U3NoRGRvNnQyNDFBZmVnNFNNbkpyV3lZajREZlVxOWZqWTl2OU1wekhLRmpiTXYrRVZydVZKK0lEWnJ0RVFrdjIzcDBidXpuQWtGNDBaTloxQzlLQlBPK2VyNEk5ZitwUkkrNkN4cW9KdWIwTmwyNmNqQzV2ZmwvRkMrdm0vQWlITUVucnFibDIvZTJoS2JKRTd4dDljUjBVUnhML29jSHpFcGpzbXRoQ2lGcGt2R0YxZFI4dXNBQXBsYVQ1RmJaYjNicldOc1BTbGJHZ20xbVBTTk9xWjlyZnoxTmViVnZjZmpZMUNEcERZWU80RzBJYU9RVjlLeTIyZEl6eXRxeUlQQUl1NEpROC8rTm1IRmE5c3VTNkNWYlR0N3FMa0xTa2E3NnlSU3JjK1g4WFo5S1ZHV200ZlRkM3hObk1Hdmg0aENhVFBoQ2l5RldLVmNsT1NVUXpqeC9TaUlURU44ZW5zSjNodnFseFMxMXAwU2dlbFJRL3pqYVI0cmNIeFgzZUVqNlo5dk9qQy9udzNXNHlPYk5mS3lsTTRsaXlrcURpNUR5VmJPNGhoRHl5OUFzZ1lyM0xvVTAyM3BQeUlzYUozQkJlaXcxSDUzMXk1VzhQcCtkNktIZk9HMmFGTEtGZUp1dTF4UnFLWXUwQ2RLU0dLVnd5Tkt6eWUzMW1iSFgybG8xZ082NUwxM1NpRmJaYUlraEx0TElOWGhublNWMm5YcnlNTWdNQ2RlcXg3TlNLQkUrL0x5V2FPYU15RnVQd0NqN0dQbUh5UHA3bzY0d0lYams1RCtKaVNNczZlN2NucmpnUTc0OXlPSklzYmxycUJnWkN6WkQ4TFVZRU1YRlg4NTdhc1BuOVpoUTlqNENtU3pRdWFsT1VoYk1raTFFU1VrbTY2MWhUNng2MTJKL245ODNYU1ViRkZhUXQ2YzRaWUpyMFZTdW5EUkZBWm4zaEE3K2RRcVJUOVhFckhQQWU4elkxSmRRRkQyYWRLaExsakJTY0sreFY5cHhvbW9WWkN0R3ZzeEJXTEx2TGJJczZVb2wrOU10YmY1NW9ITkdubHBYKzVFSE5MVFBlcW0wSm0xOUtURXFtZlVtd2QzMzY2RmxIdnZ2Q0RqZXBVYTRlU2Q5ZG9DRzk2Wm9hZytONUg1V1FsemkzYUZtUlYwZElYWVZvTVN4U2oyc2h6d2RmVHdkTGJMM2tMZWJjc2l3TVF0RU5wcjJyYlFna3V5N1RUNlNseDFSQlBXcFRwYUFLYWl5ejlhQXlHaFBlREM3ZWt6NCtCRUlWdHUyWThnT2czNmhqQmRJZThkMml6TzRGRTR4RGR2TGtFWUVlNFRsTE94cXc5TVFKeG53YmpJME95cHM0UWUxdEdJUSs4ODNHek1KSi84Ly96UjAzamhhT0lVbUZxaE9QRDFsbEI1OUY3T1RNQWxHNm5NTG1FOUgrWGFZQ0VyN3dMZjRoVTVFS241TVMwdStTZC9mYlNNclBGKy9QbXF5aEFXZnZ4NUNMZXNvaUpXRkowTWFrV0EzMERTL29iYm5IYkJBRGtpMThVWHhSWG5oeDZoRk9FL2ZwRGY4bEZZeTlmM0RIYlJiUng5NG9FRkNMaGU4b3JQVXd6NWRpNlA4NldTMWp1a1N3N01zWWpRM0xkbWh0Qmx4THd5UUYyZkR5SDVidHl4VVIveFkxOEtGNEU2Zy9xRnNtZlVQUTdud01jTkFLS0lxR2xLUEhZdEpjQUdZQXp6ZElNenJZYnkrODJIQi95NSIsbjo0MDAwMDB9Owpjb25zdCB1PXM9PlVpbnQ4QXJyYXkuZnJvbShhdG9iKHMpLGM9PmMuY2hhckNvZGVBdCgwKSk7CmFzeW5jIGZ1bmN0aW9uIG9wZW4ocGluKXtjb25zdCBrbT1hd2FpdCBjcnlwdG8uc3VidGxlLmltcG9ydEtleSgncmF3JyxuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUocGluKSwnUEJLREYyJyxmYWxzZSxbJ2Rlcml2ZUtleSddKTsKY29uc3Qgaz1hd2FpdCBjcnlwdG8uc3VidGxlLmRlcml2ZUtleSh7bmFtZTonUEJLREYyJyxzYWx0OnUoUC5zKSxpdGVyYXRpb25zOlAubixoYXNoOidTSEEtMjU2J30sa20se25hbWU6J0FFUy1HQ00nLGxlbmd0aDoyNTZ9LGZhbHNlLFsnZGVjcnlwdCddKTsKcmV0dXJuIEpTT04ucGFyc2UobmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKGF3YWl0IGNyeXB0by5zdWJ0bGUuZGVjcnlwdCh7bmFtZTonQUVTLUdDTScsaXY6dShQLmkpfSxrLHUoUC5jKSkpKX0KbGV0IHBpbj0nJyxidXN5PWZhbHNlO2NvbnN0IGRvdHM9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2RvdHMnKSxtc2c9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xtc2cnKTsKY29uc3QgZHJhdz0oKT0+Wy4uLmRvdHMuY2hpbGRyZW5dLmZvckVhY2goKGQsaSk9PmQuY2xhc3NMaXN0LnRvZ2dsZSgnZicsaTxwaW4ubGVuZ3RoKSk7CmFzeW5jIGZ1bmN0aW9uIHByZXNzKHYpe2lmKGJ1c3kpcmV0dXJuO2lmKHY9PT0nZGVsJyl7cGluPXBpbi5zbGljZSgwLC0xKTtkcmF3KCk7cmV0dXJufWlmKHBpbi5sZW5ndGg+PTQpcmV0dXJuO3Bpbis9djtkcmF3KCk7CiBpZihwaW4ubGVuZ3RoPT09NCl7YnVzeT10cnVlO21zZy50ZXh0Q29udGVudD0n0J7RgtC60YDRi9Cy0LDRjuKApic7dHJ5e2NvbnN0IGQ9YXdhaXQgb3BlbihwaW4pO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsb2NrJykucmVtb3ZlKCk7CiAgY29uc3Qgdz1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTt3LmlubmVySFRNTD1kLmJvZHk7ZG9jdW1lbnQuYm9keS5hcHBlbmQoLi4udy5jaGlsZE5vZGVzKTsKICBjb25zdCBsYj1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtsYi5jbGFzc05hbWU9J2xvY2tidG4nO2xiLnRleHRDb250ZW50PSfwn5SSINCX0LDQutGA0YvRgtGMINC/0LvQsNC9JztsYi5vbmNsaWNrPSgpPT5sb2NhdGlvbi5yZWxvYWQoKTtkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcud3JhcCcpLmFwcGVuZENoaWxkKGxiKTsKICAoMCxldmFsKShkLmpzKX1jYXRjaChlKXttc2cudGV4dENvbnRlbnQ9J9Cd0LXQstC10YDQvdGL0LkgUElOJztkb3RzLmNsYXNzTGlzdC5hZGQoJ2VycicpO3NldFRpbWVvdXQoKCk9Pntkb3RzLmNsYXNzTGlzdC5yZW1vdmUoJ2VycicpO3Bpbj0nJztkcmF3KCk7bXNnLmlubmVySFRNTD0nJm5ic3A7JztidXN5PWZhbHNlfSw3MDApfX19CmNvbnN0IHBhZD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGFkJyk7WycxJywnMicsJzMnLCc0JywnNScsJzYnLCc3JywnOCcsJzknLCcnLCcwJywnZGVsJ10uZm9yRWFjaCh2PT57Y29uc3QgYj1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtiLnR5cGU9J2J1dHRvbic7CiBpZighdil7Yi5zdHlsZS52aXNpYmlsaXR5PSdoaWRkZW4nfWVsc2UgaWYodj09PSdkZWwnKXtiLmNsYXNzTmFtZT0neCc7Yi50ZXh0Q29udGVudD0n4oyrJ31lbHNlIGIudGV4dENvbnRlbnQ9djtiLm9uY2xpY2s9KCk9PnByZXNzKHYpO3BhZC5hcHBlbmRDaGlsZChiKX0pOwpkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJyxlPT57aWYoL15bMC05XSQvLnRlc3QoZS5rZXkpKXByZXNzKGUua2V5KTtpZihlLmtleT09PSdCYWNrc3BhY2UnKXByZXNzKCdkZWwnKX0pOwppZignc2VydmljZVdvcmtlcicgaW4gbmF2aWdhdG9yKXtuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5yZWdpc3Rlcignc3cuanMnKS5jYXRjaCgoKT0+e30pfQo8L3NjcmlwdD4KCjwvYm9keT48L2h0bWw+"], "/manifest.webmanifest": ["application/manifest+json", "eyJuYW1lIjoi0JzQuNC70LvQuNC+0L0g0LTQviAyNSIsInNob3J0X25hbWUiOiLQnNC40LvQu9C40L7QvSIsInN0YXJ0X3VybCI6Ii4vIiwiZGlzcGxheSI6InN0YW5kYWxvbmUiLCJiYWNrZ3JvdW5kX2NvbG9yIjoiI2VlZjFlZCIsInRoZW1lX2NvbG9yIjoiIzE3NzA0ZiIsImljb25zIjpbeyJzcmMiOiJpY29uLTE4MC5wbmciLCJzaXplcyI6IjE4MHgxODAiLCJ0eXBlIjoiaW1hZ2UvcG5nIn0seyJzcmMiOiJpY29uLTUxMi5wbmciLCJzaXplcyI6IjUxMng1MTIiLCJ0eXBlIjoiaW1hZ2UvcG5nIn1dfQ=="], "/sw.js": ["application/javascript", "Y29uc3QgQz0ncGxhbi12Myc7c2VsZi5hZGRFdmVudExpc3RlbmVyKCdpbnN0YWxsJyxlPT57ZS53YWl0VW50aWwoY2FjaGVzLm9wZW4oQykudGhlbihjPT5jLmFkZEFsbChbJy4vJywnaW5kZXguaHRtbCcsJ21hbmlmZXN0LndlYm1hbmlmZXN0JywnaWNvbi0xODAucG5nJ10pKSk7c2VsZi5za2lwV2FpdGluZygpfSk7c2VsZi5hZGRFdmVudExpc3RlbmVyKCdhY3RpdmF0ZScsZT0+c2VsZi5jbGllbnRzLmNsYWltKCkpO3NlbGYuYWRkRXZlbnRMaXN0ZW5lcignZmV0Y2gnLGU9PntlLnJlc3BvbmRXaXRoKGZldGNoKGUucmVxdWVzdCkudGhlbihyPT57Y29uc3QgY3A9ci5jbG9uZSgpO2NhY2hlcy5vcGVuKEMpLnRoZW4oYz0+Yy5wdXQoZS5yZXF1ZXN0LGNwKSk7cmV0dXJuIHJ9KS5jYXRjaCgoKT0+Y2FjaGVzLm1hdGNoKGUucmVxdWVzdCkudGhlbihyPT5yfHxjYWNoZXMubWF0Y2goJ2luZGV4Lmh0bWwnKSkpKX0pOw=="], "/icon-180.png": ["image/png", "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"], "/icon-512.png": ["image/png", "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAIAAAB7GkOtAAAYLklEQVR4Xu3daYxd51nA8bvN5t1xYjuOYzvxFttN3aRNm9iobAVRUCmkAiEkpEqABKLQFAQCqR9AQogPSEBpaUtVVFEQSIhCUQUFhIqqJDSrEy9JHLvekjSJnXiL7Zl7Z7loMsJ17Vnu3Lnvuefc5/f7nHj28z/nOe95T3nNQx8uARBPJd6XDMAkAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAgqoF/bp7yA/fs+iXPrh80UA5y6/p6aP1P/jymx35iJ/6tdUbVxfj93BiovTRP3ntwuWJjnzhGfvB3UMPPbgy4w/atv95dvhPv3Ku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kkjzH9omANBhL77SOHMhu7VAOdmGiCISAOiwjKdA2U+c6BkCAJ2X2RRochO65zOdONFLBAA678grjdPns5gCdX0DIgpNACCJbCYzj2a+4oheIgCQRAZPhHXxwWN6gwBAEke/M/r6ubRToOdfapzt6gbUFJ0AQCoPJ57PZDNloocJAKSSdHfot19Caf0PC1Je89CHF/QPAFBMrgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACCo/wNWfL7gYa5p2AAAAABJRU5ErkJggg=="]};
// ---------- end plan assets ----------

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(startScraper(env));
    if (new Date(event.scheduledTime).getUTCHours() === 3) ctx.waitUntil(morningPost(env));   // 08:17 Tashkent
    const hU = new Date(event.scheduledTime).getUTCHours();
    if (hU === 3) ctx.waitUntil(planReminder(env, false));   // 08:17 Tashkent
    if (hU === 15) ctx.waitUntil(planReminder(env, true));   // 20:17 Tashkent
  },
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.hostname === 'plan.narxi.site') {
      const p = url.pathname === '/' ? '/index.html' : url.pathname, f = PLAN_ASSETS[p];
      if (!f) return new Response('not found', { status: 404 });
      const bin = Uint8Array.from(atob(f[1]), c => c.charCodeAt(0));
      return new Response(bin, { headers: { 'content-type': f[0], 'cache-control': 'no-cache', 'x-robots-tag': 'noindex, nofollow' } });
    }
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
