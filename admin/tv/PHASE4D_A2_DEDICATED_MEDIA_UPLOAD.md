# Phase 4D-A2 — Dedicated Media Upload Revision

Dedicated media uses the shared `tv_content` repository with:

- `source_type = dedicated_screen`
- `source_id = state_code`
- `content_type = image`
- private bucket `tv-content`
- path prefix `cms-dedicated-screen/<state>/...`

`tv_state_assets.content_id` maps each editable runtime state to its dedicated media row.

The upload UX supports JPG/PNG/WebP, 10 MB client guard, signed preview, replace, and reset/remove.
The old object is deleted only after DB mapping succeeds. No revision/publish mutation is included.
