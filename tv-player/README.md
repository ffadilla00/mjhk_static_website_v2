# MJHK TV — Phase 3A Visual Player Foundation

Target branch: `feature/tv-phase3a-player`

Phase 3A membangun fondasi visual/state-machine player TV MJHK yang berjalan di browser 1920×1080. Belum terhubung ke Gateway real.

## Implemented
- fixed 1920×1080 stage
- auto scaling ke viewport laptop
- header MJHK
- prayer panel
- Ramadan mode: Syuruq slot → Imsak
- slideshow placeholder
- running text
- state engine
- accelerated scenario runner
- developer control panel

## State foundation
NORMAL, PRE_ADHAN, ADHAN, IQAMAH_COUNTDOWN, IQAMAH, SALAT,
PRAYER_PROHIBITION, SYURUQ, ISYRAQ, IMSAK,
FRIDAY_PRE_ADHAN, FRIDAY_KHUTBAH, FRIDAY_SALAT.

## Run

```bash
python -m http.server 5501
```

Buka:
`http://127.0.0.1:5501/tv-player/`

Jangan buka lewat file:// karena memakai JavaScript modules.

## Boundary
Phase 3A: visual foundation + state engine + dev scenario.
Phase 3B: Gateway client + bootstrap/revision/heartbeat/commands.
Phase 3C: offline cache + media prefetch + scheduler/recovery.
