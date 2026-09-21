# MJHK TV — Phase 4C-B Running Text Editor

Phase 2 already provides the dedicated table `public.tv_running_text` with
`text_content`, `sort_order`, `priority`, `active`, scheduling, and weekdays.

The locked presentation runtime is state-aware, so 4C-B adds one additive source field:

```text
state_scope text[] not null default ['NORMAL']
```

Allowed state codes match the locked player states.

Future Phase 4F mapping:

```text
text_content -> running_text[].text
active       -> running_text[].enabled
priority     -> running_text[].priority
starts_at    -> running_text[].starts_at
ends_at      -> running_text[].ends_at
state_scope  -> running_text[].state_scope
```

## Run order

1. Supabase SQL Editor:

```text
supabase/tv/phase4c-running-text/00_add_running_text_state_scope.sql
supabase/tv/phase4c-running-text/01_verify_running_text.sql
```

2. Repo:

```bash
node scripts/apply-tv-phase4cb-running-text-menu.mjs
bash scripts/verify-tv-phase4cb-running-text-editor.sh
```

3. Open:

```text
/admin/tv-running-text.html
```

## Acceptance

Create:
- NORMAL-only active row;
- NORMAL + PRE_ADHAN row with higher priority;
- disposable scheduled/inactive row.

Then edit text/priority, change state scope, change weekdays, reload to verify persistence,
delete the disposable row, and run:

```text
supabase/tv/phase4c-running-text/02_running_text_acceptance.sql
```

The invalid-state query must return zero rows.

4C-B does not publish a revision or push anything directly to the TV player.
