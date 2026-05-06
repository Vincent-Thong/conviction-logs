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
