# MJHK TV — Phase 3A.1 Visual Contract

Status: **Visual polish / presentation layer**

This phase does **not** change the locked Phase 3A state engine, triggers,
countdown semantics, priority, or zero-state transition behavior.

## 1. Identity

Admin-configurable later:
- logo
- mosque name
- address / identity text

Phase 3A.1 provides `VISUAL_CONFIG.identity` as the player-side contract.

## 2. Slideshow content-type contract

Prepared content types:

- `text`
- `image`
- `image_text`
- `video`
- `finance_report`
- `gallery`

Scheduling, duration, fullscreen, always-show, monitor/app placement and ordering
remain content metadata to be hydrated from CMS/revision data in later phases.

## 3. Dedicated state-screen ownership

| State | Owner | Admin custom asset | Notes |
|---|---|---:|---|
| PRE_ADHAN | MJHK TV | No | Locked live countdown template |
| ADHAN | Admin | Yes | Custom visual; beep remains separate audio rule |
| IQAMAH_COUNTDOWN | MJHK TV | No | Locked live countdown template |
| IQAMAH | Admin | Yes | Custom visual; beep remains separate audio rule |
| SALAT | Admin | Yes | Custom visual |
| PRAYER_PROHIBITION | Admin | Yes | Custom visual |
| SYURUQ | Admin | Yes | Custom visual |
| ISYRAQ | Admin | Yes | Custom visual |
| IMSAK | Admin | Yes | Custom visual |
| FRIDAY_PRE_ADHAN | MJHK TV | No | Locked live countdown template |
| FRIDAY_KHUTBAH | Admin | Yes | Custom visual |
| FRIDAY_SALAT | Admin | Yes | Custom visual |

`assetUrl` is intentionally `null` in Phase 3A.1. Phase 3B+ can hydrate it from
the published revision without changing the rendering contract.

## 4. Prayer panel

Admin-configurable later:
- left / right placement
- panel background
- title/text color
- time color
- active/upcoming highlight background
- active/upcoming title/time color

The player now highlights the next chronological prayer from the current
simulator clock instead of permanently highlighting Subuh.

Ramadan rule remains:
**the Syuruq display slot changes to Imsak**.

## 5. Typography

Core TV typography remains controlled by MJHK TV and sized for large-screen
distance readability. Admin theming should not be allowed to freely collapse
critical font sizes.

## 6. Header and running text

Prepared theme tokens:
- header background/text
- running-text background/text
- running label background/text

## 7. State transition

Presentation-only fade/scale transition is added.
It does not delay or alter state-engine transitions.

## 8. Running-text state behavior

Default Phase 3A.1 policy:

| State | Running text |
|---|---:|
| NORMAL | Show |
| PRE_ADHAN | Show |
| ADHAN | Hide |
| IQAMAH_COUNTDOWN | Show |
| IQAMAH | Hide |
| SALAT | Hide |
| PRAYER_PROHIBITION | Hide |
| SYURUQ | Hide |
| ISYRAQ | Hide |
| IMSAK | Show |
| FRIDAY_PRE_ADHAN | Show |
| FRIDAY_KHUTBAH | Hide |
| FRIDAY_SALAT | Hide |

This is presentation policy only; state semantics remain locked.

## 9. Production preview

Use:

`http://127.0.0.1:5501/tv-player/?mode=production`

to hide the developer panel and preview the clean TV surface.

## 10. Phase boundary

Phase 3A.1 does not:
- fetch Gateway data
- fetch Supabase directly
- store device tokens
- change state scheduling
- implement audio playback
- implement Android wrapper behavior
