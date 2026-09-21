# MJHK TV — Phase 4B CMS Shell + Dashboard

## Goal

Create the first real MJHK TV administrator surface without changing any TV
runtime behavior.

Phase 4B is read-only.

It proves that the existing admin session can securely read TV operational data
through the existing Supabase browser client and RLS.

## Database contract used

The Phase 4A audit confirmed:

```text
RLS enabled:
tv_content
tv_config_revisions
tv_devices
tv_device_commands
tv_device_pairing_sessions
```

Each table has:

```text
MJHK TV admin full access
roles = authenticated
qual = is_mjhk_admin()
with_check = is_mjhk_admin()
```

Therefore no service-role key is needed in the CMS browser.

## Important tv_content correction

The real schema is:

```text
id
title
content_type
source_type
source_id
storage_url
body_text
metadata
status
created_by
created_at
updated_at
storage_bucket
storage_path
```

There is NO `enabled` column.

Phase 4B therefore uses:

```text
status
```

as the content lifecycle indicator.

## Admin integration

The CMS uses the existing:

```js
window.mjhkSupabase
db.auth.getSession()
db.auth.signOut()
```

The apply script adds only one link to the existing admin sidebar:

```text
MJHK TV → tv.html
```

The TV CMS has its own page/files:

```text
admin/tv.html
admin/tv-admin.js
admin/tv-admin.css
```

This avoids inflating the already-large `admin/admin.js` and protects the
locked Finance/Kajian modules.

## Dashboard sections

```text
Device Online
Revision Sync
Latest Revision
TV Content

Device Runtime
Revision Terbaru
Content Library
Command Activity
```

The device query explicitly excludes:

```text
device_token_hash
```

and the CMS never reads pairing-code hashes or any server secret.

## Apply

```bash
node scripts/apply-tv-phase4b-cms-shell.mjs
bash scripts/verify-tv-phase4b-cms-dashboard.sh
```

Expected:

```text
WARN: 0
FAIL: 0
RESULT: CLEAN
```

## Browser acceptance

Open:

```text
http://127.0.0.1:5501/admin/tv.html
```

Expected:

- same admin login/session works
- simulator is visible
- network status online
- desired/applied revision shows synced
- latest revision is #5 in current test data
- Content Library shows empty state
- recent sync_now / reload_player command history is visible
- no token/hash value is shown
- Preview TV opens production-mode player

If a logged-in non-admin account is used, RLS should reject reads and the page
shows an explicit permission banner.

## Phase 4B boundary

No:

```text
content create/update/delete
device mutation
pairing mutation
command creation
revision publish
```

Those are introduced only in later Phase 4 modules.
