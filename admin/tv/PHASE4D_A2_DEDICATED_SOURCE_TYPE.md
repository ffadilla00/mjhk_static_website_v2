# Phase 4D-A2 — Dedicated Screen `source_type` Migration

## Audited contract

`public.tv_content.source_type` currently permits:

- `NULL`
- `manual`
- `agenda`
- `finance`
- `media`
- `profile`
- `system`

`public.tv_state_assets.content_id` already references `public.tv_content(id)`
with `ON DELETE SET NULL`.

`public.tv_content` also already has:

```text
UNIQUE(source_type, source_id)
```

Therefore no new table or storage columns are required.

## Change

Add one new source type:

```text
dedicated_screen
```

This enables the intended 4D-A2 ownership model:

```text
Dedicated Screen state
→ tv_state_assets.content_id
→ tv_content
   source_type = dedicated_screen
   source_id   = state_code
→ private tv-content Storage object
```

## Safety

The migration does not:

- add/drop columns;
- change `tv_state_assets`;
- mutate existing slideshow rows;
- publish a revision;
- touch player runtime.

Rollback aborts when any `dedicated_screen` content row already exists.
