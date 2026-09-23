# MJHK TV Phase 4D-A — Dedicated Screens State Contract

## Runtime states

NORMAL
PRE_ADHAN
ADHAN
IQAMAH_COUNTDOWN
IQAMAH
SALAT
PRAYER_PROHIBITION
SYURUQ
ISYRAQ
IMSAK
FRIDAY_PRE_ADHAN
FRIDAY_KHUTBAH
FRIDAY_SALAT

## Locked / protected states

PRE_ADHAN
IQAMAH_COUNTDOWN
FRIDAY_PRE_ADHAN

These remain MJHK-defined and must not expose normal edit/save controls.

## Admin-editable states

ADHAN
IQAMAH
SALAT
PRAYER_PROHIBITION
SYURUQ
ISYRAQ
IMSAK
FRIDAY_KHUTBAH
FRIDAY_SALAT

Approved special behavior:
- ADHAN: custom + beep
- IQAMAH: custom + beep

## Runtime ownership

CMS may provide presentation content only.

The locked player engine retains ownership of:
- state transitions
- prayer-time triggering
- countdown timing
- zero-transition behavior
- Friday state sequence
- overlay lifecycle

CMS must not:
- invent a state
- rename a state
- change transition graph
- alter countdown semantics
- bypass engine control

## Candidate presentation-owned fields

Audit only:
- state_code
- enabled
- title
- body/subtitle
- background/media reference
- text alignment
- overlay strength
- beep_enabled
- beep media reference
- starts_at / ends_at (only if actually needed)

## Beep rule

Explicit beep support is approved only for:
- ADHAN
- IQAMAH

## Future flow

source config
→ Phase 4F snapshot builder
→ immutable revision
→ Gateway
→ TV Player

No direct CMS → player mutation.
