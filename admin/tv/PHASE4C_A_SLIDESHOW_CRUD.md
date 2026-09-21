# MJHK TV — Phase 4C-A Slideshow Content CRUD

## Scope

Phase 4C-A introduces the first real CMS write path.

It supports draft CRUD for the slideshow types already locked by the player:

```text
image
text
image_text
```

It does not publish a revision.

## Why Running Text is deferred to 4C-B

The runtime revision schema stores Running Text separately from playlist items:

```json
{
  "running_text": [
    {
      "text": "...",
      "priority": 10,
      "state_scope": ["NORMAL"]
    }
  ]
}
```

The Phase 4A table audit proved the `tv_content` schema but did not prove that
`running_text` is an allowed `tv_content.content_type`.

Because `tv_content` has a CHECK constraint on `content_type`, 4C-A does not
invent a value and risk violating production schema.

Run:

```text
supabase/tv/phase4c-content/02_audit_content_checks.sql
```

to expose the exact CHECK expressions before designing 4C-B.

## Draft-only lifecycle

Every create/update writes:

```text
status = draft
```

The editor cannot publish, assign desired revision, or call
`tv_admin_publish_config`.

That boundary remains Phase 4F.

## Field mapping

### image

```text
title
content_type = image
storage_url = HTTPS URL
body_text = NULL
metadata:
  image_url
  alt_text
  duration_seconds
  fullscreen
  always_show
  starts_at
  ends_at
```

### text

```text
title
content_type = text
storage_url = NULL
body_text = body
metadata:
  heading
  body
  duration_seconds
  fullscreen
  always_show
  starts_at
  ends_at
```

### image_text

Combines both models.

## Runtime-compatible validation

The editor enforces:

```text
duration_seconds: integer 3–300
image URL: HTTPS only
start < end
type allowlist: image | text | image_text
```

These match the locked typed presentation adapter expectations.

## Upload boundary

Phase 4C-A accepts HTTPS image URLs.

Supabase Storage upload, bucket/path ownership, replacement cleanup, and media
selection should be added in the next media-storage subphase rather than
mixing them into the first CRUD acceptance.

## Apply

```bash
node scripts/apply-tv-phase4ca-slideshow-menu.mjs
bash scripts/verify-tv-phase4ca-slideshow-crud.sh
```

Then open:

```text
/admin/tv-content.html
```

## Acceptance

Create one draft of each type:

```text
image
text
image_text
```

Then:
- edit one item;
- verify scheduling/duration/fullscreen survive reload;
- delete one disposable test item;
- run `01_verify_slideshow_content.sql`;
- confirm revision #5 and device desired/applied revision did not change.

No TV screen change is expected because publishing is intentionally absent.
