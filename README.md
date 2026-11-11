# Narxi

Smartfon narxlarini O'zbekiston do'konlarida solishtirish / Сравнение цен на смартфоны в магазинах Узбекистана.

- `scraper/scrape.py` — robot: 3 times a day collects prices from store catalog pages that robots.txt allows (honest `NarxiBot` user agent), groups the same model across stores, appends daily history.
- `.github/workflows/scrape.yml` — runs the robot on GitHub Actions every 3 hours (GitHub sometimes skips scheduled runs, so there is a backup slot).
- `cloudflare/worker.js` — the Telegram bot @Narxi_uz_bot (webhook on api.narxi.site): registration, price alerts, /stats, /broadcast. Deployed by pasting into the Cloudflare dashboard.
- `docs/` — the app (GitHub Pages). Data in `docs/data/`.

Stores now (12): Texnomart, Olcha, Alif Shop, Beeline Market, Macbro, Idea, Maxcom, Woot, Avtech, Mi Online, Tezz, Kärcher. Prices are for reference; check the store before buying.
