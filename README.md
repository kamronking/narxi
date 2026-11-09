# Narxi

Smartfon narxlarini O'zbekiston do'konlarida solishtirish / Сравнение цен на смартфоны в магазинах Узбекистана.

- `scraper/scrape.py` — robot: 3 times a day collects prices from store catalog pages that robots.txt allows (honest `NarxiBot` user agent), groups the same model across stores, appends daily history.
- `.github/workflows/scrape.yml` — runs the robot on GitHub Actions (07:17, 13:17, 19:17 Tashkent).
- `docs/` — the app (GitHub Pages). Data in `docs/data/`.

Stores now: Texnomart, Olcha. Prices are for reference; check the store before buying.
