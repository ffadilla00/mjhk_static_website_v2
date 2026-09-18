# Phase 3B.2D-C1 Presentation Binding Core

Purpose: bind immutable typed presentation config to DOM surfaces without controlling the locked prayer state engine.

Rules:
- slideshow renders only in NORMAL
- `always_show=true` bypasses date-window filtering
- otherwise playlist uses `[starts_at, ends_at)`
- per-slide `duration_seconds`
- fullscreen is exposed only as `data-presentation-fullscreen=true|false`
- running text is enabled/date/state_scope filtered, priority-desc, joined with ` • `
- safe DOM only (`createElement`, `textContent`), no innerHTML
- no revision ACK
- no Supabase direct access
- no engine import / transitions

Verify:
`bash scripts/verify-tv-phase3b2dc-presentation-binding.sh`

Visual:
`http://127.0.0.1:5501/tv-player/presentation-binding-diagnostics.html`

After visual approval:
`bash scripts/audit-tv-phase3b2dc-player-wiring.sh`

Send the audit output before C2 so the locked Phase 3A DOM is bridged surgically, not guessed.
