# Phase 4E Audit Hotfix Findings

Confirmed from exported schema:

- `tv_admin_device_overview` uses `name`, not `device_name`.
- device command types allowed by DB:
  - sync_now
  - reload_player
  - mute
  - unmute
  - restart_app
  - refresh_screenshot
- command statuses:
  - pending
  - delivered
  - done
  - failed
  - expired
- all four device tables have RLS enabled and MJHK-admin-only full-access policy.
- pairing source stores `pairing_code_hash`, not a recoverable raw pairing code.
- device source has `display_profile_id`, desired/applied revision IDs,
  heartbeat/telemetry fields, screenshot metadata, and credential metadata.
- raw device credential/token must never be exposed in Admin CMS.
