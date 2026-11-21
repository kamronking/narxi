# Narxi

**narxi.site** — сравнение цен на технику в онлайн-магазинах Узбекистана.
*Smartfon, noutbuk va maishiy texnika narxlarini O'zbekiston do'konlarida solishtirish.*

Сайт показывает одну модель (например, iPhone 16 128 ГБ) сразу во всех магазинах, где она есть, с ценой, наличием, рассрочкой и историей цены. Пользователь может подписаться в Telegram и получить уведомление, когда цена упадёт.

Этот документ — для разработчика, который впервые открывает проект. За час чтения кода с ним можно понять всю систему.

---

## Как всё устроено (одной картинкой)

```
 Cloudflare cron (каждые 3 ч)
        │  запускает
        ▼
 GitHub Actions: scrape.yml ──► scraper/scrape.py   собирает цены 12 магазинов
        │                    └► scraper/seo.py      делает статические страницы для Google
        │  коммитит в main: docs/data/, docs/narx/, docs/sitemap.xml
        ▼
 GitHub Pages (папка docs/) = narxi.site            сайт читает JSON из docs/data/v2/
        │
        ├─ после каждого сбора: bot.yml ──► scraper/bot.py notify   уведомления «цена упала»
        └─ Telegram-бот @Narxi_uz_bot = cloudflare/worker.js         ответы бота, регистрация, утренний пост в канал
                                   │
                              Firebase (Firestore + Auth + Analytics)   пользователи и подписки
```

Своего сервера нет. Всё работает на бесплатных тарифах: GitHub Actions + GitHub Pages + Cloudflare Workers + Firebase.

---

## Структура репозитория

| Путь | Что это |
|---|---|
| `scraper/scrape.py` | **Главный робот.** Собирает товары из магазинов, склеивает одинаковые модели, пишет JSON и историю цен. |
| `scraper/seo.py` | Генерирует `docs/narx/…`: по странице на модель, страницы категорий и `sitemap.xml`. |
| `scraper/bot.py` | Рассылка «цена упала» подписчикам. Запускается из Actions после каждого сбора. |
| `scraper/admin_users.py` | Админ-скрипт: посчитать или удалить пользователей в Firestore (запуск вручную через `admin.yml`). |
| `scraper/probe*.py` | Временные скрипты разведки: проверить, отдаёт ли новый магазин данные из GitHub Actions. |
| `scraper/catalog.json` | Старый файл, в коде сейчас не используется. |
| `cloudflare/worker.js` | Telegram-бот (webhook), API `/reg` для сайта, таймер робота, утренний пост в канал. |
| `docs/index.html` | **Весь фронтенд**: одностраничное приложение (HTML + CSS + JS в одном файле, без сборки). |
| `docs/data/v2/` | Данные, которые читает сайт (создаются роботом, руками не редактировать). |
| `docs/narx/` | SEO-страницы (создаются `seo.py`, руками не редактировать). |
| `docs/app/` | Иконки и splash-экраны PWA. |
| `docs/CNAME` | Домен `narxi.site` для GitHub Pages. |
| `docs/googlead7aae526684fd69.html` | Подтверждение Google Search Console. **Не удалять.** |
| `.github/workflows/` | `scrape.yml` (сбор), `bot.yml` (уведомления), `admin.yml`, `probe.yml`. |

---

## Робот цен: `scraper/scrape.py`

### Принципы
- **Только то, что разрешает robots.txt.** `get()` проверяет robots.txt перед каждым запросом и падает с `PermissionError`, если путь запрещён.
- Честный User-Agent `NarxiBot/0.1`, пауза 1,2 с между запросами, `Crawl-delay` сайта соблюдается (`CRAWL_DELAY`).
- Защиту вроде Cloudflare challenge **не обходим**. Если магазин закрылся защитой, его убирают из списка (так было с Mi Online, Asaxiy, Mediapark, Uzum). Для таких магазинов путь один — договориться о фиде (XML/JSON-выгрузке товаров).

### Магазины
Реестр в конце файла:

```python
STORES = {'texnomart': texnomart, 'olcha': olcha, 'alif': alif, 'beeline': beeline, 'macbro': macbro,
          'idea': idea, 'maxcom': maxcom, 'woot': woot, 'avtech': avtech, 'tezz': tezz, 'karcher': karcher, 'openshop': openshop}
```

Каждая функция магазина возвращает `(items, report)`. Один `item`:

```python
{'store': 'macbro', 'title': 'iPhone 16 128GB Black', 'price': 11990000, 'old': 12990000 or None,
 'url': 'https://…', 'stock': 'ok' | 'out', 'img': 'https://…', 'cat': 'phones'}
```

Источники разные: у одних публичный JSON (Shopify `products.json` у Macbro и Kärcher), у других данные внутри HTML (Nuxt-состояние у Alif, Next.js-payload у OpenShop), у остальных разбор HTML-страниц каталога.

### Как добавить магазин
1. Проверь robots.txt и наличие защиты. Удобно через `probe.yml`: в Actions сеть отличается от локальной.
2. Напиши функцию по образцу `macbro()` или `karcher()`: собрать `items`, вызвать `_fin(items, rep)`.
3. Добавь её в `STORES`.
4. Добавь название и цвет магазина в трёх местах: `STORES` в `docs/index.html`, `STORE` в `cloudflare/worker.js`, `STORES` в `scraper/seo.py`.
5. Push в `main`: `scrape.yml` запустится сам, так как изменён `scrape.py`. Смотри `docs/data/report.json`.

### Что происходит после сбора (`main()`)
1. Все магазины опрашиваются параллельно (по одному потоку на магазин).
2. Если магазин в этот раз упал, его прошлые цены держатся до 24 часов, чтобы он не пропадал из-за одного сбоя.
3. **Склейка моделей.** `key_for()` / `model_key()` / `gen_key()` строят ключ модели (`phones:iphone16:128` и т. п.), убирают цвет и мусорные слова. Затем `merge_groups()` и `split_brand_conflicts()` чинят ошибки склейки, а телефоны с разной RAM при одинаковой памяти разводятся по разным ключам.
4. Из каждого магазина в модели остаётся лучшее предложение. Явно неверные цены (дешевле 55% от максимума) отбрасываются.
5. Пишутся файлы (см. ниже) и `report.json` — отчёт по каждому магазину: страниц, товаров, ошибок.

### Категории
`CATS` в `scrape.py`: phones, laptops, tablets, tv, monitors, audio, watches, fridges, washers, ac, home, kitchen, stoves, climate, care, printers, и всё прочее → `other`.

---

## Формат данных: `docs/data/v2/`

| Файл | Содержимое |
|---|---|
| `meta.json` | Время обновления, статус магазинов, список категорий, `deals` (топ-60 разниц), `top` (240 моделей для первой отрисовки). |
| `idx.json` | Поисковый индекс всех моделей: `[key, name, cat, min_price, n_stores, gap]`. Сайт грузит его лениво — при первом действии пользователя или через 5 с. |
| `c/<cat>.json` | Товары категории: `{key, cat, name, img, offers: [{store, title, price, old, url, stock}]}`. `other` разбит на `other-0…7.json`. |
| `h/<cat>.json` | История: `{key: {"2026-11-21": {store: price}}}`, хранится 190 дней. |
| `../latest.json`, `../history.json` | Старый формат (только телефоны) для старых версий приложения. |

---

## SEO-страницы: `scraper/seo.py`

Google плохо индексирует одностраничное приложение, поэтому для каждой модели генерируется статическая HTML-страница `docs/narx/<cat>/<slug>/` с ценами во всех магазинах, JSON-LD `Product/AggregateOffer`, похожими моделями и ссылкой в приложение `/?p=<key>`. Плюс страницы категорий, `/narx/` и `sitemap.xml`. Сайт подтверждён в Google Search Console, карта сайта отправлена.

---

## Фронтенд: `docs/index.html`

Один файл, без сборщиков и фреймворков: открыл, поправил, запушил. Основное:
- состояние в объекте `S` (вкладка, категория, поиск, выбранный товар), навигация через `history.pushState`;
- `render()` → `renderHome()`, `renderFind()`, `renderProduct()`, `renderWatch()`, `renderBattle()` (сравнение двух моделей);
- `parseQ()` — «умный» поиск: понимает «noutbuk 8 mln gacha», «телефон до 3 млн»;
- языки uz/ru в объекте `TX`, светлая и тёмная тема (стекло, `[data-theme]`);
- Firebase Auth и Firestore подгружаются лениво через `fb()`, чтобы не тормозить первую загрузку;
- регистрация через Telegram: сайт открывает бота, бот сохраняет номер, сайт спрашивает статус у worker `/reg`.

---

## Telegram-бот и Cloudflare Worker: `cloudflare/worker.js`

Деплоится вручную: скопировать файл в панель Cloudflare → Workers. Домен `api.narxi.site`.

- `POST /hook` — webhook Telegram: `/start`, подписка на цену, регистрация по номеру, «Мои товары», поддержка.
- `GET /reg?id=` — сайт проверяет, зарегистрирован ли посетитель.
- `GET /setup?key=` — один раз установить webhook.
- **Cron `17 */3 * * *`** запускает `scrape.yml` через GitHub API (у GitHub собственный schedule часто пропускает запуски) и каждое утро (~08:17 по Ташкенту) публикует топ-5 разниц цен в канал @narxi_site.

---

## Секреты (в репозитории их нет)

| Где | Имя | Зачем |
|---|---|---|
| GitHub → Settings → Secrets | `TG_BOT_TOKEN` | токен бота для `bot.py` |
| GitHub | `FIREBASE_SA` | JSON сервис-аккаунта Firebase |
| Cloudflare Worker | `TG_BOT_TOKEN`, `FIREBASE_SA` | то же для worker |
| Cloudflare Worker | `WEBHOOK_SECRET` | защита webhook и `/setup` |
| Cloudflare Worker | `GH_TOKEN` | fine-grained токен (только этот репозиторий, Actions: read & write) для запуска робота |
| Cloudflare Worker | `ADMIN_CHAT` | куда слать служебные сообщения |

Публичный `apiKey` Firebase в `index.html` — это нормально: доступ ограничивают правила Firestore.

Коллекции Firestore: `users`, `site_reg`, `tg_users`, `tg_alerts`, `bot`. Личные данные (номера телефонов) хранятся только там, никогда в репозитории.

---

## Запуск локально

```bash
pip install requests
python scraper/scrape.py      # нужен доступ в интернет к магазинам; пишет docs/data/
python scraper/seo.py         # пишет docs/narx/ и docs/sitemap.xml
cd docs && python -m http.server 8000   # открыть http://localhost:8000
```

Без доступа к магазинам можно просто запустить сервер на `docs/`: в репозитории всегда лежат свежие данные.

---

## Правила работы с репозиторием

- Изменения — через ветку и Pull Request в `main`.
- Робот сам коммитит `docs/data`, `docs/narx`, `docs/sitemap.xml` (сообщения `prices …`). Эти папки руками не менять: следующий сбор их перезапишет.
- Если сбор упал — сначала смотреть `docs/data/report.json` и лог `collect prices` в Actions.

## Типичные поломки

| Симптом | Причина и что делать |
|---|---|
| У магазина 0 товаров в `report.json` | Магазин поменял вёрстку или API → обновить его функцию. Если в ошибках `403` или challenge — включили защиту, это не обходить. |
| Две разные модели склеились в одну | Поправить `model_key()` / `gen_key()` или добавить правило в `split_brand_conflicts()`. |
| Цены давно не обновлялись | Истёк `GH_TOKEN` в Cloudflare (бот пришлёт предупреждение в `ADMIN_CHAT`) → создать новый. |
| Бот молчит | Проверить секреты worker и заново открыть `/setup?key=…`. |

---

Контакт: Telegram [@narx_support](https://t.me/narx_support) · Канал: [@narxi_site](https://t.me/narxi_site)
