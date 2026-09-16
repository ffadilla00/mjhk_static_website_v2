# MJHK TV Gateway Worker — Phase 2C

Version `0.1.0`.

This Worker is the secure HTTPS gateway between the Android TV player and the Phase 2B Supabase RPC layer.

## Architecture

```text
Android TV
  ↓ device_code + device_token
Cloudflare Worker
  ↓ Supabase service_role (server-side secret only)
Phase 2B RPC
  ↓
Supabase
```

The Android TV never receives the Supabase service-role key.

## Routes

Public:
- `GET /health`
- `POST /v1/pair/claim`

Device-authenticated:
- `GET /v1/device/bootstrap`
- `POST /v1/device/heartbeat`
- `GET /v1/device/revision`
- `GET /v1/device/revision/:revision_id`
- `POST /v1/device/revision/ack`
- `GET /v1/device/commands`
- `POST /v1/device/commands/:command_id/ack`
- `POST /v1/device/screenshot`
- `GET /v1/device/media/:content_id`

Protected device requests require:

```text
Authorization: Bearer <device_token>
X-MJHK-Device-Code: <device_code>
```

## Secret

Configure only as a Worker secret:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Never place the service-role value in:
- Git
- `wrangler.jsonc`
- Android APK
- frontend JS
- chat

## Local

```bash
npm install
npm run check
npm run dev
```

For local secret testing, copy `.dev.vars.example` to `.dev.vars` and fill locally.

## Deploy

```bash
npm run deploy
```

## Security baseline

- strict HTTP methods
- JSON request-size limits
- screenshot maximum 5 MB
- screenshot MIME allowlist
- no-store
- CSP `default-src 'none'`
- no raw PostgreSQL errors returned
- private screenshot bucket
- short-lived signed URLs for private media
- device auth revalidated by Supabase RPC every protected request

## Required edge rate limiting before real pairing

Recommended starting point:

- `/v1/pair/claim`: 5 requests / 10 minutes / IP
- `/v1/device/*`: coarse protection around 120 requests / 10 minutes / IP

Several TVs may later share one mosque public IP, so device-path limits should not be overly strict.
