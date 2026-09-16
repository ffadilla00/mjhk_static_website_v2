# MJHK TV Phase 2C — Secure Gateway Architecture

## Trust boundary

### Android TV may know
- gateway URL
- its own `device_code`
- its own random `device_token`
- cached config/media

### Worker may know
- Supabase project URL
- Supabase service-role secret

### Android TV must never know
- service-role key
- admin token
- Cloudflare API token
- another TV's device token

## Pairing

```text
Admin CMS
  ↓ tv_admin_register_device()
one-time pairing code
  ↓
TV -> POST /v1/pair/claim
  ↓
Worker -> tv_device_claim_pairing()
  ↓
raw 256-bit device token returned once
```

Database stores the token hash only.

## Runtime auth

Worker forwards `device_code + device_token` to Phase 2B RPC.
The database remains the authoritative device registry.

Benefits:
- immediate revocation
- immediate token rotation
- one authorization source
- no local Worker device database

## Config sync

```text
Admin: Terapkan ke TV
  ↓
immutable revision N
  ↓
desired_revision_id = N
  ↓
TV heartbeat detects desired != applied
  ↓
fetch revision
  ↓
validate/cache media
  ↓
atomic switch
  ↓
ACK
  ↓
applied_revision_id = N
```

If a new revision cannot be completed, the TV keeps its last working revision.

## Commands

Command pull uses the Phase 2B lease model.
Commands should be implemented idempotently where possible because a lost ACK can cause redelivery.

## Screenshots

```text
TV
 ↓ authenticated image POST
Worker authenticates device
 ↓
private Storage upload
tv-monitor/<device_uuid>/<timestamp>-<uuid>.webp
 ↓
report screenshot path RPC
```

The database stores the private object path, not a permanent public URL.

## Private media

For managed TV media:
- `storage_bucket`
- `storage_path`

Worker authenticates device and returns a signed URL with a short TTL.
Legacy/external `storage_url` can still be returned when present.
