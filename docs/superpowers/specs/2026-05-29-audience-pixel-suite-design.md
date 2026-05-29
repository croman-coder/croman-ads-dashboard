# Audience + Pixel + Wizard v2 Suite — Design Spec

**Date:** 2026-05-29
**Status:** Approved (design phase)
**Author:** Croman Ads
**Supersedes:** none — extends approval-workflow (2026-05-24)

## 1. Purpose

Transform the dashboard from a read/mutate analytics tool into a complete
performance-media platform. Add: target-audience discovery per account,
retargeting (custom audiences), lookalikes, pixel + Conversions API tracking,
and integrate all of it into a redesigned ad-creation wizard with an impactful
visual layer.

Every audience/pixel mutation routes through the existing `/approvals` gate.

## 2. Scope & Phasing

Six subsystems, built sequentially A → B → C → D → E, with F (visual) applied
transversally across every new and touched page.

| Phase | Subsystem | Mutation? | Depends on |
|-------|-----------|-----------|------------|
| A | Pixel + Conversions API | configure_capi → approval | — |
| B | Audience Intelligence | read-only | insights API |
| C | Custom Audiences (4 sources) | create → approval | A |
| D | Lookalikes | create → approval | C |
| E | Create-ad Wizard v2 | create_campaign → approval | A,B,C,D |
| F | Visual overhaul | — | transversal |

Each phase is independently testable and shippable. A failing later phase must
not break earlier ones.

## 3. Phase A — Pixel + Conversions API

### 3.1 Detection (`/api/pixel/[account]`)
- `getPixels(accountId)` → `GET /act_{id}/adspixels` → list pixels.
- `getPixelStats(pixelId)` → last 7d event counts: PageView, ViewContent,
  Lead, Purchase, with last-fire timestamp.
- `getCapiStatus(pixelId)` → detects server-origin events (CAPI live or not).
- Health classification: `active` (events <24h) / `stale` (no recent events) /
  `missing` (no pixel).

### 3.2 CAPI server-side flow
```
CRM sale (Bitrix / FacturacionUnidades)
  → POST /api/capi/event
       { email, phone, value, currency, event_name, event_time, fbc?, fbp? }
  → server SHA256-hashes PII
  → POST graph.facebook.com/{pixel}/events { data:[...], access_token }
  → Meta matches to click → attribution closed (post-iOS)
```

### 3.3 PII handling (security-critical)
- SHA256 hashing happens **server-side** in `/api/capi/event` before any
  outbound call. Raw PII is never logged.
- Normalization before hash: email → lowercase + trim; phone → E.164 digits.
- Raw PII is **never persisted** to Postgres. Stored: event_id, send status,
  truncated hash (debug only).
- Endpoint auth: requires a logged-in session OR `CAPI_INGEST_KEY` header
  (for the external CRM source).
- Env: `CAPI_DATASET_ID` (falls back to pixel_id), reuses `META_ACCESS_TOKEN`
  (`ads_management` scope already present), `CAPI_INGEST_KEY`.

### 3.4 Approval gate
- Enabling CAPI per account = `proposal_action: configure_capi`.
- Individual event sends do NOT pass the gate (high volume) — only initial setup.

### 3.5 UI — `/pixel`
- Per-account pixel cards: health dot, event counts, last fire, CAPI on/off.
- Step-by-step guide for missing pieces (install pixel, enable CAPI).

### 3.6 meta-api additions
`getPixels`, `getPixelStats`, `getCapiStatus`, `sendCapiEvent`.

## 4. Phase B — Audience Intelligence

### 4.1 Data (`/api/audience/insights/[account]`)
Pulls historical insights with breakdowns: `age`, `gender`, `age,gender`,
`region`, `publisher_platform,platform_position`, `device_platform`,
`impression_device`. Each segment → spend, leads, CPL, CTR.

### 4.2 Heuristic engine (`audience-intelligence.ts`)
```
score(segment) = w_leads * (leads/total_leads)
               - w_cpl   * (cpl/avg_cpl)
               + w_ctr   * (ctr/avg_ctr)
```
Outputs per account:
- Top segments (age+gender+region combos) ranked by CPL + volume.
- Recommended audience string (e.g. "Hombres 35-44 · Central + Alto Paraná ·
  CPL $2.10, -34% vs cuenta").
- Winning/losing placements.
- Under-utilized segments (good CPL, low spend → scale).
- Leak segments (high spend, bad CPL → cut).

### 4.3 UI — `/audience/intelligence`
- Breakdown selector (age/gender/geo/placement/device).
- Ranked table by score + CPL heatmap.
- "Público recomendado" card.
- "Usar en nueva campaña" → pre-loads targeting into Wizard v2.

Read-only. No approval gate.

## 5. Phase C — Custom Audiences (4 sources)

### 5.1 Sources
| Source | Meta subtype | Params |
|--------|-------------|--------|
| Pixel events | WEBSITE | pixel_id, event, retention 30/60/90/180d |
| Engagement IG/FB | ENGAGEMENT | page_id/ig_id, type (video viewers, profile, leadform openers), retention |
| Lead forms | LEAD_GEN | form_id, openers vs submitters, retention |
| Customer list | CUSTOM | SHA256-hashed file (client-side), schema EMAIL/PHONE |

### 5.2 UI — `/audiences`
- Table of existing audiences: name, approx size, type, age, status.
- "Nueva audiencia" → source selector modal → params form.
- Customer list: CSV/Excel dropzone → parse in browser → SHA256 each
  email/phone → preview count → upload hashed only.

### 5.3 meta-api additions
`listCustomAudiences`, `createCustomAudience`.

## 6. Phase D — Lookalikes

- Seed = existing custom audience (ideally customer-list of buyers).
- Ratio 1/2/3/5%. Country PY.
- One-click "Crear LAL" from any custom audience row.
- meta-api: `createLookalike`.

## 7. Approval gate extensions

New `proposal_action` enum values:
- `configure_capi`
- `create_audience` (pixel/engagement/leadform)
- `upload_customer_list` (PII — diff shows count + schema, NEVER raw data)
- `create_lookalike` (seed + ratio + country)

DiffViewer additions render source, params, estimated size. PII never appears
in a proposal payload — only hash count + schema.

## 8. Phase E — Create-ad Wizard v2

`/campaigns/new` rebuilt as a 5-step stepper:
```
1 OBJETIVO   → Leads/Mensajes/Tráfico/Conversiones + budget (cap $1000)
2 AUDIENCIA  → tabs: Recomendada (Phase B) · Guardadas · Custom/Retargeting (C)
               · Lookalike (D) · Manual (age/gender/geo/interests search)
               + live reach estimate
3 PIXEL/CONV → pixel + optimization event + CAPI on/off (Phase A)
4 CREATIVO   → upload + brief IA + copys (existing /creative flow)
5 REVIEW     → summary + diff → /approvals
```
- Live reach: `/api/reach-estimate` → Meta `delivery_estimate`.
- Interest search: `/api/targeting-search` → Meta `adinterest` autocomplete.

## 9. Phase F — Visual overhaul (transversal)

- Apply v3 tokens (paper bg, indigo, Geist/Fraunces) consistently to ALL pages.
- Wizard: animated progress bar, selectable hover-lift cards.
- Audiences: size bars, color-coded type badges.
- Pixel: large green/amber/red health dots.
- Intelligence: CPL heatmap, gradient charts.
- Microinteractions: spring transitions, skeleton loaders, blur-in.
- Fix known legacy issues found during each phase.

### 9.1 Known errors to fix in F
- `/audience` page is legacy (text-slate, no v3 theme).
- Old wizard lacks audiences/pixel.
- Sidebar must add: Pixel, Audiencias, Intelligence entries.

## 10. Sidebar nav (final)

- **Análisis**: Dashboard, Analítica, Intelligence, Alertas
- **Operación**: Crear con IA, Campañas, Anuncios, Audiencias, Biblioteca, Presupuestos
- **Tracking**: Pixel
- **Control**: Aprobaciones, Ajustes

## 11. Testing

- Phase A: unit test SHA256 normalization (email/phone vectors), CAPI payload
  shape, health classification. Mock Meta `/events` response.
- Phase B: unit test scoring engine with synthetic breakdown data.
- Phase C/D: unit test proposal payload builders; verify PII never in payload.
- Phase E: component test wizard step transitions + reach-estimate fetch mock.
- Each phase: build passes, preview verification of touched pages.

## 12. Out of scope

- Multi-platform (Google/TikTok) — Meta only.
- Automated bid management.
- Real-time CAPI event streaming dashboard (only setup + status).
- Audience overlap analysis.
