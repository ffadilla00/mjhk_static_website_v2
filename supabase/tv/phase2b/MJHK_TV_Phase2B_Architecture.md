# MJHK TV — Phase 2B Secure Device Architecture

## Goal

Create a secure bridge between the future Android TV player and the Phase 2A Supabase data model without exposing privileged Supabase credentials to the TV.

## Locked architecture

```text
Admin CMS
   │ authenticated Supabase user
   ▼
Admin RPCs
   │
   ▼
Supabase PostgreSQL
   ▲
   │ service_role (SERVER-SIDE ONLY)
   │
Cloudflare Worker: worker-tv-mjhk
   ▲
   │ HTTPS + device_code + random device token
   │
Android TV Player
```

The Android TV player does **not** connect directly to privileged Supabase RPCs.

## Why a Worker gateway

The gateway gives us:

- service-role secret stays server-side
- rate limiting
- request-size validation
- device-token validation through database RPC
- private Storage signed URLs
- screenshot upload to private bucket
- consistent HTTP error mapping
- API versioning
- logging without exposing database implementation

## Device identity

Each device has:

- `device_code`: public identifier, e.g. `MJHK-...`
- `device_token`: random 256-bit secret, returned once during pairing
- `device_token_hash`: SHA-256 hash stored in Supabase
- `credential_version`
- `paired_at`

The raw token is stored only on the Android TV in app-private storage.

## Pairing

```text
Admin CMS
  │
  ├─ Add Device
  │
  ▼
tv_admin_register_device()
  │
  ├─ device_code
  ├─ one-time pairing code
  └─ expiry (default 15 min)

TV Player
  │ user enters pairing code
  ▼
POST /v1/pair/claim
  ▼
Worker
  ▼
tv_device_claim_pairing()
  │
  └─ returns raw 256-bit device token ONCE

TV stores:
  device_code
  device_token
```

Pairing codes:
- 12 hexadecimal characters
- hashed in database
- default TTL 15 minutes
- max TTL 60 minutes
- one-time use
- superseded codes expire when a claim succeeds

Worker should rate-limit pairing aggressively.

## Runtime authentication

Recommended HTTP headers from TV:

```text
Authorization: Bearer <device_token>
X-MJHK-Device-Code: MJHK-...
X-MJHK-Player-Version: 1.0.0
```

Worker extracts the code/token and calls the device RPC using Supabase `service_role`.

## Configuration publishing

Editable tables are the admin working configuration.

When DKM presses **Terapkan ke TV**:

```text
tv_admin_publish_config()
       │
       ├─ validates config
       ├─ creates immutable JSON snapshot
       ├─ marks previous revision superseded
       ├─ publishes one new revision
       └─ sets desired_revision_id on enabled devices
```

The device then sees:

```text
desired revision > applied revision
```

and downloads the new snapshot.

It must fully download/cache required assets before changing `applied_revision_id`.

If an asset/config fails, it keeps the previous working revision.

## Atomic sync

```text
Revision N (working)
      │
      ├─ download Revision N+1
      ├─ validate config
      ├─ download/cache required assets
      ├─ verify media
      │
      └─ atomic switch
             ↓
      ack Revision N+1
```

Partial configuration must never become active.

## Heartbeat

Default:
- heartbeat: 30 sec
- screenshot: 60 sec
- command poll: 15 sec
- offline threshold: 90 sec

Heartbeat contains lightweight telemetry:

- app version
- Android version
- model
- resolution
- mute state
- current state
- current content
- slide index / total
- remaining seconds
- last player error

## Commands

Command queue uses lease semantics.

A pulled command gets a 60-second lease.

If the player disappears before acknowledgement:
- command becomes eligible for redelivery
- maximum delivery attempts: 5
- expired commands are never executed

MVP commands:
- `sync_now`
- `reload_player`
- `mute`
- `unmute`
- `refresh_screenshot`

Schema retains `restart_app`, but UI execution may remain deferred until Android stability testing.

## Screenshots

Do not upload screenshots directly with a service-role key from Android.

Flow:

```text
Android screenshot
      ↓
POST /v1/device/screenshot
      ↓
Worker authenticates device
      ↓
Worker uploads to private tv-monitor bucket
      ↓
<device_uuid>/<timestamp>.webp
      ↓
tv_device_report_screenshot()
```

Admin live monitoring requests a short-lived signed URL through the Worker.

The database stores the Storage path, not an expiring signed URL.

## Private TV content

New managed TV media should use:

- `storage_bucket`
- `storage_path`

External/legacy media may continue using `storage_url`.

For `tv-content` private objects the Worker issues short-lived signed download URLs.

## Threat boundaries

### Android TV may know
- public TV API URL
- device_code
- its own random device_token
- downloaded config/media

### Android TV must never know
- Supabase service-role key
- Cloudflare API token
- admin user token
- another TV's token
- database credentials

### Worker may know
- Supabase URL
- Supabase service-role key
- API-specific secrets

All are stored as Worker secrets, never committed to Git.

## Phase 2B completion criteria

- SQL migration clean
- device RPCs inaccessible to `anon`
- device RPCs inaccessible to ordinary `authenticated`
- service_role can execute device RPCs
- admin RPCs gated by `is_mjhk_admin()`
- pairing code/token stored only as hashes
- revision publisher works
- command lease model present
- regression smoke remains clean
- Worker itself can be implemented/tested next without schema redesign
