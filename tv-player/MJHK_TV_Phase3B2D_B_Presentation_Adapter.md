# MJHK TV — Phase 3B.2D-B Typed Presentation Adapter v1

Observed schema from 3B.2D-A representative audit is now locked into an
allowlisted presentation adapter.

## Accepted playlist types

- `image`
- `text`
- `image_text`

No other slideshow type is accepted in this phase. Future types such as video,
finance-report, or gallery must be added deliberately after their schema is
defined and tested.

## Playlist contract

Shared fields:

```text
id: string
type: image | text | image_text
title: string
duration_seconds: integer 3..300
fullscreen: boolean
always_show: boolean
starts_at: null | datetime
ends_at: null | datetime
payload: object
```

Payload union:

```text
image:
  image_url: HTTPS URL
  alt_text: string

text:
  heading: string
  body: string

image_text:
  image_url: HTTPS URL
  heading: string
  body: string
```

## Running text contract

```text
id: string
text: non-empty string
enabled: boolean
priority: integer -1000..1000
starts_at: null | datetime
ends_at: null | datetime
state_scope: non-empty array of locked MJHK TV states
```

## Security / stability behavior

- unsupported playlist type rejected
- unknown state rejected
- non-HTTPS media URL rejected
- invalid schedule window rejected
- excessive item counts rejected
- typed result deep-frozen
- no DOM binding
- no state-engine access
- no revision ACK
- no content values logged

## Verify

```bash
bash scripts/verify-tv-phase3b2d-presentation-adapter.sh
```

Expected:

```text
WARN: 0
FAIL: 0
RESULT: CLEAN
```

## Browser test

Open:

```text
http://127.0.0.1:5501/tv-player/presentation-adapter-diagnostics.html
```

Run:

1. `Run Typed Adapter`
2. Expected metadata:
   - playlist_count = 3
   - image = 1
   - text = 1
   - image_text = 1
   - running_text_count = 2
   - state scopes include NORMAL and PRE_ADHAN
   - frozen = true
3. `Test Unsupported Type`
4. Expected:
   `FAILURE ISOLATED • presentation unchanged • playlist_type_unsupported`

## Boundary

This phase still does NOT render the typed config into the locked player DOM.
That binding is the next explicit step, after this adapter is approved.
