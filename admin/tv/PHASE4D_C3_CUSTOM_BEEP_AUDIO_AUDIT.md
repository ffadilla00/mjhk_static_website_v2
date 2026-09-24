# Phase 4D-C3 Custom Beep Audio — Audit Boundary

## Deferred
Phase 4D-C2 Pre-Adhan Audio / Murottal / Tarhim is deferred.
`tv_audio_rules` remains untouched.

## Candidate custom cues
- ADHAN
- IQAMAH
- FORBIDDEN_PRAYER
- ISYRAQ
- IMSAK

Existing count settings remain authoritative until audit proves otherwise:
- `beep_adhan_count`
- `beep_iqamah_count`
- `beep_forbidden_count`
- `beep_isyraq_count`
- `beep_imsak_count`

The future custom audio contract must preserve a built-in fallback so a missing/unavailable custom file cannot make the cue silent.
