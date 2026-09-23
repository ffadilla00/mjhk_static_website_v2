# MJHK TV Phase 4D-A — Dedicated Screens Architecture & Schema Audit

## Purpose

Before building the Dedicated Screens CMS, inspect the real locked runtime
contract and the current Supabase schema.

Main risk:
letting CMS configuration accidentally take ownership of behavior that belongs
to the locked TV state engine.

## Approved matrix

### Locked
PRE_ADHAN
IQAMAH_COUNTDOWN
FRIDAY_PRE_ADHAN

### Editable
ADHAN
IQAMAH
SALAT
PRAYER_PROHIBITION
SYURUQ
ISYRAQ
IMSAK
FRIDAY_KHUTBAH
FRIDAY_SALAT

ADHAN and IQAMAH may support custom beep/audio cues.

## Audit questions

1. Where should editable screen source data live?
2. Does a dedicated table already exist?
3. Are any screen fields already embedded in revision snapshots?
4. Can tv_content media be reused?
5. Can beep assets reuse current private media delivery?
6. What exact fields does stateOverlay/renderState consume?
7. Which fields belong to engine behavior and must remain non-editable?
8. How should Phase 4F serialize screens into snapshot?
9. Per-state rows or one JSON document?
10. Which locked states should be visible-but-read-only?

## Candidate source models

### Model A — dedicated relational table

Possible conceptual shape:

tv_dedicated_screens
- id
- state_code unique
- enabled
- title
- body
- media_content_id
- beep_enabled
- beep_content_id
- config jsonb
- created_by
- created_at
- updated_at

Pros:
- explicit finite state contract
- easy CMS CRUD
- strong constraints
- deterministic Phase 4F serialization

Cons:
- may need flexible config JSON for visuals

### Model B — one JSON settings document

Pros:
- flexible
- similar to revision snapshot

Cons:
- weaker integrity
- harder auditing and partial update
- easier to mix engine and presentation fields

### Model C — reuse tv_content

Pros:
- existing CRUD/storage

Cons:
- dedicated screens are not normal slideshow content
- state identity becomes a metadata convention
- audio/media linkage becomes awkward

## Audit preference

If current schema does not already solve it:

prefer Model A — dedicated relational source table.

## CMS-owned fields candidate

Presentation only:
- enabled
- title
- body/subtitle
- media_content_id
- text alignment
- overlay strength
- beep_enabled
- beep_content_id

Optional scheduling only if product need is real:
- starts_at
- ends_at

## Must remain engine-owned

- next_state
- transition_after_seconds
- engine_priority
- countdown_remaining
- prayer trigger time
- Friday transition sequence
- runtime current_state

## Media candidate

Reuse private tv-content media where possible.

Potential future references:
media_content_id → tv_content.id
beep_content_id  → tv_content.id

Audit must confirm current content constraints and Gateway media behavior.

## Proposed CMS UX after audit

Dedicated Screens

LOCKED
- PRE_ADHAN
- IQAMAH_COUNTDOWN
- FRIDAY_PRE_ADHAN

EDITABLE
- ADHAN
- IQAMAH
- SALAT
- PRAYER_PROHIBITION
- SYURUQ
- ISYRAQ
- IMSAK
- FRIDAY_KHUTBAH
- FRIDAY_SALAT

Locked rows remain visible but read-only.

## Phase boundary

No mutation in 4D-A.

4D-A does NOT:
- create tv_dedicated_screens
- alter snapshot schema
- change player rendering
- change engine behavior
- upload beep media
- publish revision
- change desired_revision_id

After audit review:
- 4D-A1 source schema
- 4D-A2 CMS editor
- 4D-A3 source-to-snapshot contract

Actual publish remains Phase 4F.
