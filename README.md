# Croman Ads Dashboard

Meta Ads management dashboard — Santa Rosa Paraguay.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4
- Recharts
- Lucide icons
- Meta Marketing API v21.0

## Setup local

```bash
npm install
cp .env.example .env.local
# Edit .env.local — add META_ACCESS_TOKEN
npm run dev
```

Open http://localhost:3000

## Environment variables

| Variable | Required | Example |
|---|---|---|
| `META_ACCESS_TOKEN` | yes | `EAAb0yONX06EB...` |
| `META_API_VERSION` | no (default `v21.0`) | `v21.0` |

## Deploy Vercel

1. Project on Vercel pointing to this repo.
2. Add env vars in Project Settings → Environment Variables.
3. Push to `main` → auto deploy.

## Routes

| Route | Purpose |
|---|---|
| `/` | Dashboard — KPIs + campaigns table |
| `/approvals` | Cola de aprobación de mutaciones risky |
| `/campaigns` | Campaign editor (Phase 2) |
| `/ads` | Ad creative management (Phase 3) |
| `/audience` | Targeting editor (Phase 2) |
| `/budgets` | Budget editor (Phase 2) |
| `/analytics` | Deep breakdowns (Phase 2) |
| `/settings` | Configuration |

## API routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/accounts` | GET | List ad accounts |
| `/api/campaigns?account_id=` | GET | List campaigns |
| `/api/insights?account_id=&since=&until=&level=` | GET | Insights with leads/msgs |

## Phase roadmap

- **Phase 1 (current):** read-only dashboard, multi-account, KPIs, charts, table.
- **Phase 2:** mutations (rename, status, targeting, placement, budget).
- **Phase 3:** creative management (upload, swap lead form, wizard new campaigns).
