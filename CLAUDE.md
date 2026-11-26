# Narxi — notes for Claude

**narxi.site** compares prices and instalment plans for electronics across online stores in Uzbekistan.
Owner: Kamron Nomonjonov (founder, not a professional developer — the project is "vibe-coded" with Claude).
Talk to him in Russian (he often writes in transliteration); site, video and social texts are in Uzbek (Latin).
For the full architecture read `README.md` first.

## Map
| Path | What |
|---|---|
| `docs/index.html` | The whole site in ONE file (HTML+CSS+JS, ~1000 lines). Texts in a `uz:{…}` / `ru:{…}` dictionary, `t('key')`. |
| `docs/data/v2/` | Data the scraper writes: `meta.json`, `c/<category>.json` (products + offers), `h/<category>.json` (price history). Never edit by hand. |
| `scraper/scrape.py` | Scraper for 16 stores (texnomart, olcha, alif, beeline, macbro, idea, maxcom, woot, avtech, tezz, karcher, openshop, castore, diskont, ispace, radius). Matches the same model across stores. |
| `scraper/laptopkey.py` | Matching key for laptops: `brand:series:cpu[+gpu]:ram-ssd`. |
| `scraper/seo.py` | Static model pages `docs/narx/…` + `sitemap.xml`. |
| `scraper/bot.py` | "Price dropped" Telegram notifications. |
| `cloudflare/worker.js` | Worker on api.narxi.site: Telegram bot @Narxi_uz_bot, 3-hour cron that dispatches the scrape workflow, daily "find of the day" post. The deployed version is edited in the Cloudflare dashboard and can differ from the repo. |
| `.github/workflows/scrape.yml` | Collect prices → commit `docs/data` → GitHub Pages publishes. |

Hosting is free: GitHub Pages (`docs/`), GitHub Actions, Cloudflare Workers, Firebase. Domain narxi.site is registered at Namecheap, DNS on Cloudflare.

## Offer data model
Offer fields: `store`, `price`, `old` (crossed-out price), `url`, `plans` = `[[months, monthly], …]`, `inst`/`instm` (longest plan), `inst_est` (plan estimated from the store's rates, show as "≈").

## How to ship a change
1. Branch from `main`, change, test locally (`python3 -m http.server` in `docs/`, check the browser console for errors, phone width 390 px and desktop).
2. Push the branch, open a PR, squash-merge. (`gh pr create` may fail — use the REST API: `gh api repos/kamronking/narxi/pulls …`, then `gh api -X PUT …/pulls/N/merge -f merge_method=squash`.)
3. Pages redeploys in ~1 minute; users may need Ctrl+Shift+R.
4. The scrape workflow commits to `main` every 3 hours — always rebase on fresh `main` before pushing.

## Site rules
- Uzbek is the default language; every new text needs both `uz` and `ru`.
- Theme attribute is `data-nxtheme` on `<html>` (not `data-theme` — browser extensions overwrite that).
- Colours: brand green `#0c5a43`, lime `#c8f169`, fonts Onest (text) + Unbounded (display). Dark and light themes both must work.
- Keep it modest and minimal; no store logos (trademarks) — show store names as text.
- Don't mention robots.txt or scraping details in visitor-facing text.
- Never put the owner's phone, personal email or age on the site.

## Hard rules
- Do not bypass Cloudflare/anti-bot protection or robots.txt of any store (Uzum and Mediapark block us — partnership only).
- Never enter passwords, API keys or payment details; never solve captchas.
- Ask before deleting anything permanently or spending money.
- In videos and posts use only real numbers from the data, don't name the most expensive store, and don't accuse a specific store of cheating.

## Working with Kamron
He tends to jump to new ideas before the current one is finished, and asked to be told honestly when that happens. Current priority: audience (Instagram Reels/videos), not new features. Budget is near zero — prefer free solutions.
