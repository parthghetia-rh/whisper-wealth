# WhisperWealth

> Your private financial dashboard.

A local-only, self-hosted portfolio tracker for monitoring stock holdings, dividends, sitting cash, and live market prices. Built for privacy — runs entirely on your machine with no external hosting, no accounts, and no telemetry.

## Features

- **Transaction Management** — Add, edit, delete, and CSV import buy/sell transactions for any ticker
- **Live Market Data** — Real-time stock prices from Yahoo Finance, configurable refresh (30s to 5min)
- **Watchlist** — Track any ticker with independent refresh controls and sortable columns
- **Dividend Tracking** — Projected weekly/monthly/yearly dividend income from actual payment history
- **Sitting Cash** — Track idle cash with configurable interest rates and projected interest income
- **Multi-Currency Support** — Handles USD, CAD, INR, EUR, GBP and more with live forex conversion
- **Currency Converter** — Toggle display currency to see your entire portfolio converted at live rates
- **Portfolio Allocation** — Pie chart and percentage breakdown of your holdings
- **Dividend Comparison Charts** — Visual comparison of dividend yields and payment trends
- **CSV Import** — Import transactions from Wealthsimple, Questrade, or any generic CSV
- **6 Built-in Themes** — Midnight, Carbon, Ocean, Emerald, Sunset, Rose
- **Privacy Toggle** — Hide/show values in the allocation view
- **Draggable Sidebar** — Reorder navigation tabs to your preference
- **Mobile Responsive** — Collapsible sidebar, scrollable tables, stacking layouts
- **Fully Local** — SQLite database stored on disk, server bound to localhost only

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

```bash
git clone <repo-url> && cd whisperwealth
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000)

Your data is persisted in a Docker volume (`folio-data`). It survives container rebuilds.

### Docker (Manual)

```bash
docker build -t whisperwealth .
docker run -d \
  --name whisperwealth \
  -p 127.0.0.1:3000:3000 \
  -v folio-data:/data \
  -e DB_PATH=/data/portfolio.db \
  whisperwealth
```

### Local Development (No Docker)

Requires Node.js 20+.

```bash
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
│   │   ├── transactions.js # Buy/sell CRUD + CSV import
│   │   ├── portfolio.js    # Holdings, summary, SSE, rates
│   │   ├── dividends.js    # Dividend income calculations
│   │   ├── cash.js         # Sitting cash positions
│   │   └── watchlist.js    # Watchlist CRUD + quotes
│   └── services/
│       ├── stockService.js # Yahoo Finance API wrapper
│       ├── poller.js       # Price/dividend/rate refresh
│       └── csvParser.js    # CSV import parser
├── src/                    # React frontend
│   ├── pages/              # Dashboard, Transactions, Dividends, Cash, Watchlist
│   ├── components/         # Shared UI components
│   ├── hooks/              # useApi, useSSE
│   └── utils/              # Currency helpers, theme definitions
├── samples/                # Sample CSV files for import testing
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Disclaimer

This application is a personal portfolio tracking tool and is **not financial advice**. Market data is provided by Yahoo Finance and may be delayed or inaccurate. Dividend projections are estimates based on historical payments and are not guaranteed. Do not make financial decisions based solely on this tool. Always consult a qualified financial advisor.

This project was built with the assistance of **Claude** by Anthropic. The code is provided as-is with no warranty. Use at your own risk.

## License

MIT
