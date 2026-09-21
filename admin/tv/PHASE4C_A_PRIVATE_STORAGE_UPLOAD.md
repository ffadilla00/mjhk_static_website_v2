# MJHK TV Phase 4C-A — Private Storage Upload

The Storage audit confirmed:

```text
bucket: tv-content
public: false
file_size_limit: 104857600 bytes
allowed:
  image/jpeg
  image/png
  image/webp
  video/mp4
  audio/mpeg
  audio/mp4
  audio/ogg
```

Admin Storage policies exist for authenticated `is_mjhk_admin()` users:

```text
SELECT
INSERT
UPDATE
DELETE
```

for:

```text
tv-content
tv-monitor
```

## CMS upload contract

4C-A uses only image MIME types:

```text
image/jpeg
image/png
image/webp
```

and applies a stricter client limit of 10 MB.

Object paths are generated as:

```text
cms-slideshow/<admin-user-id>/<timestamp>-<uuid>.<ext>
```

The `tv_content` row stores:

```text
storage_bucket = tv-content
storage_path   = generated path
storage_url    = NULL
```

The bucket remains private.

## Admin preview

The CMS generates a temporary signed URL:

```js
createSignedUrl(storage_path, 3600)
```

This URL is used only for admin preview and is not stored in the database.

## Replacement

When an admin replaces an image:

```text
upload new object
→ update tv_content
→ delete old object
```

If the database update fails:

```text
new object is removed
old object remains
```

## Delete

Draft deletion removes the database row first, then performs Storage cleanup.

## Runtime boundary

Phase 4C-A does not convert the private storage object into a TV runtime media
URL. That transformation belongs to Publish/Revision construction in Phase 4F,
where a snapshot can point to the authenticated Gateway media route.

No revision or desired device configuration is mutated in this phase.

## Apply

```bash
node scripts/apply-tv-phase4ca-private-storage-upload.mjs
bash scripts/verify-tv-phase4ca-private-storage-upload.sh
```

Then create an image draft from `/admin/tv-content.html`.

Run:

```text
supabase/tv/phase4c-content/04_verify_private_storage_upload.sql
```

Expected:

```text
storage_bucket = tv-content
storage_path starts cms-slideshow/
storage_url = NULL
status = draft
```
