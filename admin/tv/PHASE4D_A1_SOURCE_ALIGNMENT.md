# MJHK TV Phase 4D-A1 — Audited Source Alignment v3

This migration is based on the live schema audit.

## Confirmed tv_state_definitions shape

```text
state_code
display_name
priority_rank
priority_class
default_duration_seconds
interrupts_normal_content
hide_running_text
resume_policy
trigger_start_notes
trigger_end_notes
enabled
created_at
updated_at
```

## Confirmed existing states

The database already contains:

```text
ADHAN_COUNTDOWN
ADHAN_PAUSE
FORBIDDEN_PRAYER
IQAMAH_COUNTDOWN
IQAMAH_PAUSE
ISYRAQ
JUMAT_ADHAN_KHUTBAH
JUMAT_PRE_ADHAN
MAINTENANCE
NORMAL
SALAT
SALAT_JUMAT
SYURUQ_WAIT
TARHIM
```

IMSAK is the only required state missing for the approved Phase 4D contract.

## Confirmed publish behavior

`tv_admin_publish_config` already serializes:

```text
system_settings
state_definitions
state_assets
```

Therefore no publish RPC mutation is required in Phase 4D-A1.

## Beep contract

```text
ADHAN  → beep_adhan_count
IQAMAH → beep_iqamah_count
ISYRAQ → beep_isyraq_count every day after SYURUQ wait
IMSAK  → beep_imsak_count only while Ramadan mode is active
```

## SYURUQ → ISYRAQ

Existing source settings already support:

```text
syuruq_wait_minutes
isyraq_duration_minutes
beep_isyraq_count
```

Semantics:

```text
effective SYURUQ
→ SYURUQ_WAIT
→ wait syuruq_wait_minutes
→ ISYRAQ beep
→ ISYRAQ screen
```

The wait duration remains a Phase 4D-C Prayer Settings responsibility.

## Locked screens remain runtime-owned

```text
PRE_ADHAN
IQAMAH_COUNTDOWN
FRIDAY_PRE_ADHAN
```

No editable asset contract is added for those states in A1.
