# MJHK TV — Phase 2B RPC + HTTP API Contract

## Admin RPCs

These are called from the existing authenticated MJHK Admin CMS.

### `tv_admin_register_device(name, display_profile_id?, pairing_ttl_minutes?)`

Returns:

```json
{
  "device_id": "uuid",
  "device_code": "MJHK-...",
  "pairing_code": "A1B2C3D4E5F6",
  "pairing_expires_at": "..."
}
```

The pairing code is shown once in the Admin UI.

### `tv_admin_create_pairing_code(device_id, ttl?, invalidate_existing_token?)`

Used for re-pairing.

Default does **not** invalidate an existing working token until the new pairing is claimed.

### `tv_admin_publish_config(change_summary)`

Creates one immutable published revision.

Returns:

```json
{
  "revision_id": "uuid",
  "revision_number": 1,
  "devices_targeted": 1
}
```

### `tv_admin_revoke_device(device_id, reason?)`

Immediately:
- disables device
- removes stored token hash
- expires open pairing sessions
- expires unfinished commands

---

# Gateway-only device RPCs

These are callable by `service_role` only.

The TV must reach them through `worker-tv-mjhk`.

## Pair

HTTP:

```text
POST /v1/pair/claim
```

Body:

```json
{
  "pairing_code": "A1B2-C3D4-E5F6",
  "device_info": {
    "app_version": "1.0.0",
    "device_model": "Coocaa ...",
    "android_version": "...",
    "screen_width": 1920,
    "screen_height": 1080
  }
}
```

Worker RPC:
`tv_device_claim_pairing(text,jsonb)`

Response contains the raw device token exactly once.

## Bootstrap

```text
GET /v1/device/bootstrap
```

Headers:
- `Authorization: Bearer ...`
- `X-MJHK-Device-Code: ...`

Worker RPC:
`tv_device_bootstrap(text,text)`

Returns:
- server time
- device id/name
- desired/applied revision
- active revision
- heartbeat/screenshot/command intervals

## Heartbeat

```text
POST /v1/device/heartbeat
```

Example body:

```json
{
  "app_version": "1.0.0",
  "device_model": "Coocaa",
  "android_version": "11",
  "screen_width": 1920,
  "screen_height": 1080,
  "is_muted": true,
  "current_state": "NORMAL",
  "current_content_id": null,
  "current_slide_index": 2,
  "total_slides": 8,
  "remaining_seconds": 9,
  "last_error": null
}
```

Worker RPC:
`tv_device_heartbeat(text,text,jsonb)`

## Download revision

```text
GET /v1/device/revision/:revision_id?
```

Worker RPC:
`tv_device_get_revision(text,text,uuid)`

If revision id omitted, desired revision is returned.

## Acknowledge revision

```text
POST /v1/device/revision/ack
```

Body:

```json
{
  "revision_id": "uuid",
  "success": true,
  "error_message": null
}
```

Worker RPC:
`tv_device_ack_revision(...)`

A successful ACK is accepted only for the device's current desired revision.

## Pull commands

```text
GET /v1/device/commands
```

Worker RPC:
`tv_device_pull_commands(text,text,integer)`

Lease:
- 60 seconds
- max 5 delivery attempts

## Acknowledge command

```text
POST /v1/device/commands/:id/ack
```

Body:

```json
{
  "status": "done"
}
```

or:

```json
{
  "status": "failed",
  "error_message": "..."
}
```

## Upload screenshot

```text
POST /v1/device/screenshot
Content-Type: image/webp
```

Worker:
1. authenticates the device
2. validates image MIME + size
3. uploads to private `tv-monitor`
4. object path:
   `<device_uuid>/<timestamp>.webp`
5. calls `tv_device_report_screenshot()`

Recommended maximum screenshot size: 5 MB.

## Private media

Suggested endpoint:

```text
GET /v1/device/media/:content_id
```

Worker:
1. authenticates device
2. resolves `storage_bucket/storage_path`
3. creates short-lived signed URL
4. returns 302 or JSON signed URL

Recommended signed URL TTL: 5–15 minutes.

## HTTP error mapping

Recommended Worker mapping:

- `ADMIN_REQUIRED` -> 403
- `PAIRING_INVALID_OR_EXPIRED` -> 401 or 410
- `DEVICE_AUTH_FAILED` -> 401
- `REVISION_NOT_ALLOWED` -> 403
- `STALE_REVISION_ACK` -> 409
- `COMMAND_NOT_FOUND_OR_ALREADY_FINAL` -> 409
- malformed JSON -> 400
- rate-limited -> 429
- unexpected database error -> 500 with generic body

Do not return raw PostgreSQL stack traces to the TV.
