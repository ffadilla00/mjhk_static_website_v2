# Phase 4D-C3 — Custom Beep Audio Source Contract

## Scope

C3 source layer adds custom cue assets for:

- ADHAN
- IQAMAH
- PRAYER_PROHIBITION
- ISYRAQ
- IMSAK

Existing `beep_*_count` fields remain authoritative for repeat-count behavior.

## Storage

Uses the existing private bucket:

`tv-content`

Path ownership:

`cms-beep-audio/<cue>/...`

Accepted application MIME:

- `audio/mpeg`
- `audio/mp4`
- `audio/ogg`

Application limit: 5 MB.

## Config

Stored under:

`tv_system_settings.beep_audio_config`

The database stores storage identity, not signed URLs.

## Fallback

If a cue is disabled, absent, or cannot be resolved at runtime, the future runtime
controller must use built-in beep.

## Phase boundary

This source editor does NOT activate the custom audio in the TV Player.
Phase 4F Publish & Revision remains the authority for distributing source changes
to devices.

The audited safe runtime hook for future activation is the existing
`engine.addEventListener("change", ...)` listener in `player.js`.
The state engine itself must remain unchanged.

## Deferred

`tv_audio_rules` remains owned by deferred Phase 4D-C2 Pre-Adhan Audio.
