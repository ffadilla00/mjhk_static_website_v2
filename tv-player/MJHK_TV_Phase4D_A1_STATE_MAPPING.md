# MJHK TV Phase 4D-A1 — Source ↔ Runtime State Mapping v2

## Locked runtime-owned screens

These states do not require editable `tv_state_assets` rows:

| Runtime state | CMS |
|---|---|
| PRE_ADHAN | LOCKED / runtime-owned |
| IQAMAH_COUNTDOWN | LOCKED / runtime-owned |
| FRIDAY_PRE_ADHAN | LOCKED / runtime-owned |

## Editable screen mapping

| Runtime state | tv_state_assets.state_code |
|---|---|
| ADHAN | adhan_pause |
| IQAMAH | iqamah_pause |
| SALAT | salat |
| PRAYER_PROHIBITION | forbidden_prayer |
| SYURUQ | syuruq_wait |
| ISYRAQ | isyraq |
| IMSAK | imsak |
| FRIDAY_KHUTBAH | jumat_adhan_khutbah |
| FRIDAY_SALAT | salat_jumat |

## Beep behavior

ADHAN:
`tv_system_settings.beep_adhan_count`

IQAMAH:
`tv_system_settings.beep_iqamah_count`

ISYRAQ:
`tv_system_settings.beep_isyraq_count`

Daily flow:

```text
SYURUQ
→ wait for tv_system_settings.syuruq_wait_minutes
→ beep ISYRAQ
→ ISYRAQ
```

IMSAK:
`tv_system_settings.beep_imsak_count`

Only effective when Ramadan mode resolves ON.

```text
Ramadan OFF → no IMSAK / no IMSAK beep
Ramadan ON  → IMSAK eligible / configured beep
```

`beep_forbidden_count` remains unchanged for backward compatibility.
