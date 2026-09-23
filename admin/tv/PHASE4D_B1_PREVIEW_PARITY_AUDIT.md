# Phase 4D-B1 Preview Parity Audit

Audit goals:

1. Real TV Player DOM anchors
2. Real CSS dependency order
3. Visual config application path
4. Existing mode parsing
5. Runtime side effects:
   - revision sync
   - heartbeat
   - commands
   - device auth
6. CMS mock-preview differences
7. Safe Preview-mode boundary

Desired outcome:

Theme & Layout CMS
→ iframe `/tv-player/?mode=preview`
→ actual player renderer
→ draft theme injected locally
→ no revision/device/network side effects
