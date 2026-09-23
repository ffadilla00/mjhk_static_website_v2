# MJHK TV Phase 4D-A2 — Dedicated Screens CMS Editor

Source assignment editor only.

## Locked runtime screens

PRE_ADHAN
IQAMAH_COUNTDOWN
FRIDAY_PRE_ADHAN

They are visible but not editable.

## Editable mapping

ADHAN ← ADHAN_PAUSE
IQAMAH ← IQAMAH_PAUSE
SALAT ← SALAT
PRAYER_PROHIBITION ← FORBIDDEN_PRAYER
SYURUQ ← SYURUQ_WAIT
ISYRAQ ← ISYRAQ
IMSAK ← IMSAK
FRIDAY_KHUTBAH ← JUMAT_ADHAN_KHUTBAH
FRIDAY_SALAT ← SALAT_JUMAT

## Source mutation

Only:
- tv_state_assets.content_id
- tv_state_assets.enabled
- tv_state_assets.notes
- tv_state_assets.updated_at

## Boundary

No schema migration.
No revision publish.
No player mutation.
No prayer timing mutation.
No media upload.
