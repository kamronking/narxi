"""Narxi Telegram bot: price-drop alerts + phone registration via Telegram's own contact sharing.

Runs from GitHub Actions (polling, no server):
  * reads new messages (getUpdates) and handles /start w<id>_<priceK>, contact sharing, /list, /stop
  * after each price update, notifies subscribers whose target price is reached

Secrets (GitHub Actions): TG_BOT_TOKEN, FIREBASE_SA (service-account JSON). Data lives in Firestore
(collections tg_alerts, tg_users, bot), never in the public repo.
"""
import json, os, re, glob, sys, time, pathlib, requests

TOKEN = os.environ.get('TG_BOT_TOKEN', '').strip()
SA = os.environ.get('FIREBASE_SA', '').strip()
SITE = 'https://kamronking.github.io/narxi/'
ROOT = pathlib.Path(__file__).resolve().parent.parent
API = f'https://api.telegram.org/bot{TOKEN}/'

def fnv(s):
    """32-bit FNV-1a over UTF-16 code units, base36 — identical to pid() in docs/index.html."""
    b = s.encode('utf-16-le'); h = 0x811c9dc5
    for cu in (int.from_bytes(b[i:i + 2], 'little') for i in range(0, len(b), 2)):
        h ^= cu
        h = (h * 0x01000193) & 0xffffffff
    out, n = '', h
    while True:
        n, r = divmod(n, 36); out = '0123456789abcdefghijklmnopqrstuvwxyz'[r] + out
        if not n: break
    return out

def products():
    P = {}
    for f in glob.glob(str(ROOT / 'docs/data/v2/c/*.json')):
        if f.endswith('/other.json'): continue
        for p in json.load(open(f)):
            P[fnv(p['key'])] = p
    return P

def best(p):
    live = [o for o in p['offers'] if o.get('stock') == 'ok'] or p['offers']
    return min(live, key=lambda o: o['price'])

def tg(method, **data):
    r = requests.post(API + method, json=data, timeout=30)
    try:
        return r.json()
    except Exception:
        return {'ok': False}

def fmt(n): return f'{n:,}'.replace(',', ' ')

STORE = {'texnomart': 'Texnomart', 'olcha': 'Olcha', 'alif': 'Alif Shop', 'beeline': 'Beeline Market', 'macbro': 'Macbro', 'idea': 'Idea',
         'maxcom': 'Maxcom', 'woot': 'Woot', 'avtech': 'Avtech', 'mionline': 'Mi Online', 'tezz': 'Tezz', 'karcher': 'Kärcher'}
T = {
 'ru': {'set': '✅ Слежу за ценой\n\n{name}\nСейчас: {now} сум ({store})\nСообщу, когда будет ≤ {target} сум.',
        'reached': '🔔 Цена снизилась!\n\n{name}\nСейчас: {now} сум в {store}\nВаша цель: {target} сум\n\n{url}',
        'phone': 'Чтобы зарегистрироваться в Narxi, нажмите кнопку ниже — Telegram передаст ваш номер. Это необязательно.',
        'btn': '📱 Поделиться номером', 'thanks': '🙏 Спасибо! Номер подтверждён, вы зарегистрированы в Narxi.',
        'hello': 'Привет! Я бот Narxi. Откройте товар на сайте и нажмите «Уведомить в Telegram» — я сообщу, когда цена упадёт.\n\n' + SITE,
        'list': 'Вы следите за:\n{items}\n\nОтписаться от всего: /stop', 'empty': 'Пока ничего не отслеживается.', 'stopped': 'Готово, уведомления отключены.',
        'nf': 'Товар не найден — возможно, он больше не продаётся.'},
 'uz': {'set': "✅ Narxni kuzatyapman\n\n{name}\nHozir: {now} so'm ({store})\nNarx {target} so'm yoki undan past bo'lsa xabar beraman.",
        'reached': "🔔 Narx tushdi!\n\n{name}\nHozir: {now} so'm — {store}\nSizning maqsadingiz: {target} so'm\n\n{url}",
        'phone': "Narxi'da ro'yxatdan o'tish uchun pastdagi tugmani bosing — Telegram raqamingizni yuboradi. Bu majburiy emas.",
        'btn': '📱 Raqamni yuborish', 'thanks': "🙏 Rahmat! Raqam tasdiqlandi, siz Narxi'da ro'yxatdan o'tdingiz.",
        'hello': "Salom! Men Narxi botiman. Saytda tovarni oching va «Telegram'da xabar berish» tugmasini bosing — narx tushganda yozaman.\n\n" + SITE,
        'list': "Kuzatuvdagi tovarlar:\n{items}\n\nHammasini o'chirish: /stop", 'empty': 'Hozircha hech narsa kuzatilmayapti.', 'stopped': "Tayyor, xabarlar o'chirildi.",
        'nf': 'Tovar topilmadi — balki endi sotilmayapti.'},
}

def db():
    import firebase_admin
    from firebase_admin import credentials, firestore
    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(json.loads(SA)))
    return firestore.client()

def handle_updates(D, P):
    st = D.collection('bot').document('state'); off = (st.get().to_dict() or {}).get('offset', 0)
    res = tg('getUpdates', offset=off, timeout=0, allowed_updates=['message'])
    for u in res.get('result', []):
        off = max(off, u['update_id'] + 1)
        m = u.get('message') or {}
        chat = m.get('chat', {}).get('id'); frm = m.get('from', {})
        if not chat or m.get('chat', {}).get('type') != 'private':
            continue
        lang = 'uz' if (frm.get('language_code') or '').startswith('uz') else 'ru'
        L = T[lang]; text = (m.get('text') or '').strip()
        if m.get('contact'):
            c = m['contact']
            if c.get('user_id') == frm.get('id'):  # only the sender's own number counts as verified
                D.collection('tg_users').document(str(chat)).set({'phone': c.get('phone_number'), 'first_name': frm.get('first_name'),
                    'username': frm.get('username'), 'lang': lang, 'verified_at': int(time.time())}, merge=True)
                tg('sendMessage', chat_id=chat, text=L['thanks'], reply_markup={'remove_keyboard': True})
            continue
        mm = re.match(r'/start\s+(?:(uz|ru)_)?w([0-9a-z]{1,8})_(\d{1,7})$', text)
        if mm:
            if mm.group(1): lang = mm.group(1); L = T[lang]
            pid, target = mm.group(2), int(mm.group(3)) * 1000
            p = P.get(pid)
            if not p:
                tg('sendMessage', chat_id=chat, text=L['nf']); continue
            b = best(p)
            D.collection('tg_alerts').document(f'{chat}_{pid}').set({'chat': chat, 'pid': pid, 'key': p['key'], 'name': p['name'], 'target': target,
                'lang': lang, 'created': int(time.time()), 'last_sent': None})
            D.collection('tg_users').document(str(chat)).set({'first_name': frm.get('first_name'), 'username': frm.get('username'), 'lang': lang,
                'seen_at': int(time.time())}, merge=True)
            tg('sendMessage', chat_id=chat, text=L['set'].format(name=p['name'], now=fmt(b['price']), store=STORE.get(b['store'], b['store']), target=fmt(target)))
            if not (D.collection('tg_users').document(str(chat)).get().to_dict() or {}).get('phone'):
                tg('sendMessage', chat_id=chat, text=L['phone'], reply_markup={'keyboard': [[{'text': L['btn'], 'request_contact': True}]],
                   'resize_keyboard': True, 'one_time_keyboard': True})
        elif text.startswith('/list'):
            al = [a.to_dict() for a in D.collection('tg_alerts').where('chat', '==', chat).stream()]
            tg('sendMessage', chat_id=chat, text=L['list'].format(items='\n'.join(f"• {a['name']} — ≤ {fmt(a['target'])}" for a in al)) if al else L['empty'])
        elif text.startswith('/stop'):
            for a in D.collection('tg_alerts').where('chat', '==', chat).stream(): a.reference.delete()
            tg('sendMessage', chat_id=chat, text=L['stopped'])
        elif text.startswith('/start'):
            tg('sendMessage', chat_id=chat, text=L['hello'])
    st.set({'offset': off}, merge=True)

def notify(D, P):
    sent = 0
    for a in D.collection('tg_alerts').stream():
        d = a.to_dict(); p = P.get(d['pid'])
        if not p: continue
        b = best(p)
        if b.get('stock') != 'ok' or b['price'] > d['target']: continue
        if d.get('last_sent') and b['price'] >= d['last_sent']: continue  # only when it drops further
        L = T.get(d.get('lang'), T['ru'])
        r = tg('sendMessage', chat_id=d['chat'], text=L['reached'].format(name=p['name'], now=fmt(b['price']), store=STORE.get(b['store'], b['store']),
               target=fmt(d['target']), url=b.get('url') or SITE))
        if r.get('ok'):
            a.reference.update({'last_sent': b['price'], 'sent_at': int(time.time())}); sent += 1
        elif r.get('error_code') == 403:  # user blocked the bot
            a.reference.delete()
    print('alerts sent:', sent)

if __name__ == '__main__':
    if not TOKEN or not SA:
        print('TG_BOT_TOKEN / FIREBASE_SA not set — bot is idle'); sys.exit(0)
    D, P = db(), products()
    handle_updates(D, P)
    if 'notify' in sys.argv:
        notify(D, P)
