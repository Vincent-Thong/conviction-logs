# Conviction Logs — Investment Journal

A personal investment journal for tracking equity positions, documenting thesis, and maintaining a watchlist across HK and US markets.

## Pages

| Page | Description |
|------|-------------|
| `index.html` | Dashboard — overview stats, recent entries, watchlist snapshot |
| `portfolio.html` | Portfolio — open/closed positions table with conviction rating |
| `journal.html` | Journal — write and review investment theses and notes |
| `watchlist.html` | Watchlist — stocks on radar with price targets and catalysts |

## Structure

```
conviction-logs/
├── index.html
├── portfolio.html
├── journal.html
├── watchlist.html
├── assets/
│   └── favicon.svg
├── css/
│   ├── style.css          ← shared theme & design system
│   ├── dashboard.css
│   ├── portfolio.css
│   ├── journal.css
│   └── watchlist.css
└── js/
    ├── store.js           ← localStorage data layer
    ├── nav.js             ← shared utilities
    ├── dashboard.js
    ├── portfolio.js
    ├── journal.js
    └── watchlist.js
```

## Design

- Dark editorial theme with warm gold accents
- Fonts: DM Serif Display (headings) · Instrument Sans (body) · DM Mono (data)
- All data stored in `localStorage` — no backend required

## Usage

Open `index.html` in a browser. No build step needed — pure HTML/CSS/JS.


## PAT setup

Setup (one-time, ~2 minutes)
1. Push all files to your repo including data/store.json
2. Create a GitHub Personal Access Token:

Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
Or use this direct link: https://github.com/settings/tokens/new
Give it repo scope
Copy the token

3. Open settings.html on your site and fill in:

Your PAT
Owner: Vincent-Thong
Repo: conviction-logs
Branch: main

4. Click "Save & Connect" — it tests the connection, saves config to your browser, and syncs
5. Repeat step 3–4 on LaptopB — same config, and it will immediately load all your data from GitHub
