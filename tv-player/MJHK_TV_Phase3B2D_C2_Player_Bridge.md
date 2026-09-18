# MJHK TV — Phase 3B.2D-C2 Surgical Player Bridge v1

Based on the verified Phase 3A player wiring:

- root: `#tvStage`
- normal slideshow owner: `#normalContent`
- running text value: `#runningText`
- dedicated overlay: `#stateOverlay`
- state forwarding hook: immediately after `renderState(event.detail, refs)`

## Design

The bridge does NOT import or call the state engine.

Flow:

```text
TVStateEngine
    ↓ existing event.detail.state
renderState()                 ← locked Phase 3A behavior
    ↓
presentationBridge.setPresentationState()
    ↓
PresentationBinder
```

The engine remains the only authority for state transitions.

## Non-destructive slideshow mount

C2 does not replace `#normalContent`.

It creates:

```text
#normalContent
  existing Phase 3A placeholder
  #presentationMount          ← overlay
```

When typed content is active the mount overlays the placeholder. If no LKG or
no active remote content exists, the locked placeholder remains intact.

## Fullscreen

For a typed playlist item with `fullscreen=true`, C2 hides:

- TV header
- prayer panel
- running text bar

and lets normal presentation fill the 16:9 stage.

As soon as engine moves away from NORMAL, PresentationBinder resets fullscreen,
so dedicated prayer-state screens recover the normal layout.

## Current data source

C2 reads the Last-Known-Good snapshot from the Phase 3B browser revision store.

It does NOT yet fetch revisions automatically from Gateway. Automatic
bootstrap/fetch/store/promote/apply/ACK belongs to the following end-to-end
sync phase.

## Apply

```bash
node scripts/apply-tv-phase3b2dc2-player-bridge.mjs
```

Then:

```bash
bash scripts/verify-tv-phase3b2dc2-player-bridge.sh
```

Recommended locked regression:

```bash
bash scripts/smoke-tv-phase3b2dc2-locked-regression.sh
```

## Browser test

Because JS/CSS/HTML changed, hard refresh is recommended:

```text
Ctrl + F5
```

Open:

```text
http://127.0.0.1:5501/tv-player/
```

Expected in NORMAL:
- representative typed content overlays the old placeholder
- running text is sourced from typed config
- slideshow cycle follows duration
- fullscreen typed slide can fill the full TV stage

Expected in PRE_ADHAN / ADHAN / IQAMAH / SALAT:
- existing locked state overlay still owns the screen
- slideshow bridge does not overwrite dedicated state screen
- fullscreen resets
- existing Phase 3A running-text visibility policy still wins
- configured running text content follows `state_scope`

No revision ACK occurs in this phase.
