# Phase 4E — Devices Audit Boundary

## Goal

Define a safe Devices CMS around the existing secure device architecture.

Likely capabilities to validate:
- device list and online/offline state
- display-profile assignment
- desired vs applied revision
- last heartbeat / last seen
- latest screenshot metadata
- pairing lifecycle
- safe device commands
- command history/status
- security events

## Non-goals until audit
- no raw device-token display
- no service-role credential in browser
- no Gateway authorization bypass
- no guessed command types/status values
- no deletion/reset semantics before FK/RPC audit
- no UI implementation before exact contracts are known

## Locked/deferred status
- 4D-A2 Dedicated Screens — locked
- 4D-B1 Theme & Layout — locked
- 4D-C1 Prayer Settings — locked
- 4D-C2 Pre-Adhan Audio — deferred
- 4D-C3 Custom Beep Audio Source — locked
