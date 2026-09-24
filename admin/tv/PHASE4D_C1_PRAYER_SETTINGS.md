# Phase 4D-C1 — Prayer Settings Architecture

## Ownership

`tv_system_settings`
- global prayer calculation settings
- Ramadan / Imsak / Syuruq / Isyraq settings
- forbidden-prayer timing
- fullscreen thresholds
- beep counts
- Friday prayer end behavior

`tv_prayer_rules`
- per-prayer adjustments and durations
- Adhan countdown/pause
- Iqamah countdown/pause
- enabled flag

## Explicitly excluded

`tv_audio_rules`
- Pre-Adhan/Tarhim audio belongs to 4D-C2.

Custom beep file
- Current runtime only has beep counts.
- Custom sound file needs its own contract and belongs to 4D-C3.

Device operations
- heartbeat, screenshots, command polling, offline timeout remain Phase 4E/runtime-owned.

Revision
- no revision mutation until Phase 4F.

## Friday nullable contract

Current Jum'at row has nullable:
- `prayer_duration_minutes`
- `iqamah_countdown_minutes`
- `iqamah_pause_seconds`

The editor preserves blank → `NULL` for these fields.
