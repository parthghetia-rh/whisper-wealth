<p align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="WhisperWealth Logo" />
</p>

<h1 align="center">WhisperWealth</h1>

<p align="center">
  <strong>Your private financial dashboard.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/self--hosted-localhost%20only-22c55e?style=flat-square" alt="Self-hosted" />
  <img src="https://img.shields.io/badge/auth-token%20based-6366f1?style=flat-square" alt="Auth" />
  <img src="https://img.shields.io/badge/data-SQLite%20local-f59e0b?style=flat-square" alt="SQLite" />
  <img src="https://img.shields.io/badge/docker-ready-06b6d4?style=flat-square" alt="Docker" />
  <img src="https://img.shields.io/badge/license-AGPL--3.0-22c55e?style=flat-square" alt="License" />
</p>

<p align="center">
  A local-only, self-hosted portfolio tracker for monitoring stock holdings, dividends, sitting cash, and live market prices. Built for privacy — runs entirely on your machine with no external hosting, no accounts, and no telemetry.
</p>

---

## Why WhisperWealth??

Most portfolio trackers require you to hand your financial data to a third party. WhisperWealth flips that — your data never leaves your machine. No cloud, no accounts, no tracking. Just a clean, fast dashboard running on your own hardware.

- **Zero data collection** — No telemetry, analytics, or cookies. Ever.
- **One-command deploy** — `docker compose up -d` and you're running.
- **Live market dashboard** — Real-time prices with configurable refresh (10s to 5min), pre-market and after-hours data, SSE push updates.
- **True income projections** — Dividends from actual payment history + cash interest (simple/compound) + recurring income, all converted to your display currency.
- **Broker agnostic** — Import from any broker via CSV/TSV column mapper or printed email PDFs with auto-extraction.
- **Multi-currency native** — Track CAD, USD, INR, EUR, GBP holdings side by side with live forex conversion. Add forex pairs (CADUSD=X) to your watchlist.
- **Tailscale ready** — Access securely from any device on your private network.
- **Mobile-first** — PWA installable on your phone with bottom tab navigation and card-based views.

---

## Features

- **Transaction Management** — Add, edit, delete buy/sell transactions for any ticker
- **Universal File Import** — CSV, TSV, and PDF import with column mapping. Works with Wealthsimple, Questrade, Scotiabank, or any broker
- **PDF Email Import** — Print broker confirmation emails to PDF, drop them in, transactions are extracted automatically
- **Exchange-Aware Import** — Default exchange selector (TSX, NEO, NSE, etc.) auto-appends ticker suffixes on import
- **Live Market Data** — Real-time stock prices from Yahoo Finance, configurable refresh (30s to 5min)
- **Watchlist** — Track any ticker with 3M/6M/1Y performance, sortable columns, and click-to-expand historical charts
- **Historical Charts** — Interactive area charts with 1M/3M/6M/1Y range toggles per ticker
- **Dividend Tracking** — Projected weekly/monthly/yearly dividend income from actual payment history
- **DRIP (Dividend Reinvestment)** — Auto-reinvest dividends with fractional/whole share toggle
- **Cash & Income** — Track sitting cash with interest (simple or compound) and recurring income (cashback, rent, paybacks)
- **Multi-Currency Support** — USD, CAD, INR, EUR, GBP and more with live forex conversion
- **Currency Converter** — Toggle display currency to see your entire portfolio converted at live rates
- **Portfolio Allocation** — Pie chart and percentage breakdown with hide/show values toggle
- **Dividend Comparison Charts** — Visual comparison of dividend yields and payment trends
- **Settings** — DRIP, fractional shares, compound interest toggles
- **6 Built-in Themes** — Midnight, Carbon, Ocean, Emerald, Sunset, Rose
- **Collapsible Sidebar** — Minimize to icons on desktop, draggable tab reordering
- **Mobile App Experience** — Bottom tab navigation, card views, PWA installable on phone home screen
- **Token Auth** — Auto-generated bearer token, login page, timing-safe comparison, rate limiting
- **Security Hardened** — Helmet headers, input validation, atomic DB writes, non-root Docker, SSE limits
- **Fully Local** — SQLite database, localhost-only binding, zero telemetry

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TailwindCSS v4, Recharts |
| Backend | Node.js, Express |
| Database | SQLite (via sql.js, WASM-based) |
| Market Data | Yahoo Finance (yahoo-finance2) |
| Containerization | Docker, Docker Compose |

## Quick Start

### Docker Compose (Recommended)

No source code needed — just create a `docker-compose.yml`:

```yaml
services:
  whisperwealth:
    image: ghcr.io/parthghetia-rh/whisper-wealth:latest
    container_name: whisperwealth
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - folio-data:/data
    environment:
      - NODE_ENV=production
      - HOST=0.0.0.0
      - PORT=3000
      - DB_PATH=/data/portfolio.db
      - TOKEN_PATH=/data/.auth-token
    restart: unless-stopped

volumes:
  folio-data:
```

Then run:

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000)

On first launch, check `docker logs whisperwealth` for your auth token.

Your data is persisted in a Docker volume (`folio-data`). It survives container restarts and updates.

**To update:**

```bash
docker compose pull
docker compose up -d
```

### Docker (Manual)

```bash
docker run -d \
  --name whisperwealth \
  -p 127.0.0.1:3000:3000 \
  -v folio-data:/data \
  -e DB_PATH=/data/portfolio.db \
  -e TOKEN_PATH=/data/.auth-token \
  ghcr.io/parthghetia-rh/whisper-wealth:latest
```

### Build from Source (Docker)

```bash
git clone https://github.com/parthghetia-rh/whisper-wealth.git && cd portfolio-tracker
docker compose -f docker-compose.dev.yml up -d --build
```

### Local Development (No Docker)

Requires Node.js 20+.

```bash
git clone https://github.com/parthghetia-rh/whisper-wealth.git && cd portfolio-tracker
npm install
npm run dev
```

This starts both the backend (port 3000) and Vite dev server (port 5173) with hot reload.
Open [http://localhost:5173](http://localhost:5173)

### Production (No Docker)

```bash
npm install
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000)

## Custom Local Domain

To access WhisperWealth via a custom domain instead of `localhost:3000`:

**Option 1: /etc/hosts (simplest)**

```bash
# Add to /etc/hosts (Mac/Linux) or C:\Windows\System32\drivers\etc\hosts (Windows)
127.0.0.1  whisperwealth.local
```

Then visit `http://whisperwealth.local:3000`

**Option 2: Caddy reverse proxy (HTTPS + port 80)**

```bash
# Install Caddy, then create a Caddyfile:
whisperwealth.local {
  reverse_proxy 127.0.0.1:3000
  tls internal
}
```

Then visit `https://whisperwealth.local`

**Option 3: Tailscale MagicDNS**

If you're running Tailscale, your machine is automatically accessible at `https://your-machine.tail-net-name.ts.net`. Set `CORS_ORIGINS` to include this hostname.

## Mobile App

WhisperWealth is a Progressive Web App (PWA). On your phone:

- **iOS**: Open in Safari → Share → "Add to Home Screen"
- **Android**: Open in Chrome → Menu → "Add to Home Screen" or "Install app"

This gives you a full-screen app experience with the WhisperWealth icon on your home screen.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` inside Docker) |
| `DB_PATH` | `./portfolio.db` | Path to the SQLite database file |
| `TOKEN_PATH` | `./.auth-token` | Path to the auto-generated auth token file |
| `CORS_ORIGINS` | localhost variants | Comma-separated allowed origins |
| `NODE_ENV` | — | Set to `production` to serve the built frontend |

## Security

**Authentication**: On first launch, a random 64-character auth token is generated and saved to `.auth-token` (or `TOKEN_PATH`). The token is printed to the console on startup. All API requests require `Authorization: Bearer <token>`. The frontend fetches the token automatically when accessed from localhost.

**For Tailscale / remote access**: When accessing via Tailscale, set `CORS_ORIGINS` to your Tailscale hostname (e.g., `CORS_ORIGINS=http://my-machine:3000`). The auth token protects your data from unauthorized access by other devices on your tailnet.

**Additional hardening applied**:

- Bearer token auth on all API endpoints
- Helmet security headers (X-Content-Type-Options, X-Frame-Options, etc.)
- Rate limiting on all API routes (120 req/min) and refresh endpoint (3 req/min)
- Request body size capped at 100KB
- Input validation with length limits, format regex, and `Number.isFinite()` checks
- SSE connection limit (max 20 clients)
- Atomic database writes (write to temp file, then rename)
- Database file created with 0600 permissions (owner read/write only)
- Docker container runs as non-root user
- All data stays local — only outbound calls are to Yahoo Finance for market data
- No telemetry, no analytics, no cookies

## CSV Import

WhisperWealth supports importing transactions from CSV files. Go to the Transactions tab and click "Import CSV".

**Supported brokers:**
- Wealthsimple
- Questrade
- Generic (any CSV with Date, Symbol, Type, Quantity, Price columns)

The importer auto-detects the broker format, previews parsed transactions before importing, and skips non-buy/sell rows (dividends, deposits, etc.) with clear explanations.

A sample Wealthsimple CSV is included at `samples/wealthsimple-sample.csv`.

## Data & Backup

Your entire portfolio lives in a single SQLite file (`portfolio.db`). To back up:

```bash
# Local
cp portfolio.db portfolio.db.backup

# Docker
docker cp whisperwealth:/data/portfolio.db ./portfolio.db.backup
```

## Project Structure

```
whisperwealth/
├── server/                 # Express backend
│   ├── index.js            # Server entry, binds to localhost
│   ├── auth.js             # Token-based authentication
│   ├── db.js               # SQLite setup and helpers
│   ├── routes/
│   │   ├── transactions.js # Buy/sell CRUD + CSV/PDF import
│   │   ├── portfolio.js    # Holdings, summary, SSE, rates
│   │   ├── dividends.js    # Dividend income calculations
│   │   ├── cash.js         # Cash positions + recurring income
│   │   ├── watchlist.js    # Watchlist CRUD + charts + quotes
│   │   └── settings.js     # App settings (DRIP, compound, etc.)
│   └── services/
│       ├── stockService.js # Yahoo Finance API wrapper
│       ├── poller.js       # Price/dividend/rate refresh + DRIP
│       ├── csvParser.js    # CSV/TSV import with column mapping
│       └── pdfParser.js    # PDF text extraction + transaction parsing
├── src/                    # React frontend
│   ├── pages/              # Dashboard, Transactions, Dividends, Cash, Watchlist, Settings, Login
│   ├── components/         # Shared UI (StockCard, TickerChart, CSVImport, etc.)
│   ├── hooks/              # useApi, useSSE
│   └── utils/              # Currency helpers, theme definitions
├── samples/                # Sample CSV/TSV files for import testing
├── public/                 # Favicon, PWA manifest
├── .github/workflows/      # Docker build CI pipeline
├── Dockerfile
├── docker-compose.yml      # Production (pulls from GHCR)
├── docker-compose.dev.yml  # Development (builds from source)
└── package.json
```

## Disclaimer

This application is a personal portfolio tracking tool and is **not financial advice**. Market data is provided by Yahoo Finance and may be delayed or inaccurate. Dividend projections are estimates based on historical payments and are not guaranteed. Do not make financial decisions based solely on this tool. Always consult a qualified financial advisor.

This project was built with the assistance of **Claude** by Anthropic. The code is provided as-is with no warranty. Use at your own risk.

## License

Copyright (c) 2026 WhisperWealth.

Licensed under the [GNU Affero General Public License v3.0](LICENSE). You are free to use, modify, and distribute this software, provided that any modified versions are also made available under the same license. See [LICENSE](LICENSE) for full terms.

Built with the assistance of **Claude** by Anthropic.
