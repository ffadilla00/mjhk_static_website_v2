# Phase 4D-B1 Architecture Decision

## Source of truth

`tv_display_profiles` remains the Theme & Layout source of truth.

No parallel `tv_visual_settings` table is introduced.

## Identity

MJHK identity is global and stays local to the TV Player for this milestone.
The official MJHK logo is bundled as:

`tv-player/assets/img/mjhk-logo.png`

Theme/Layout CMS does not upload or edit the logo.

## Runtime boundary

4D-B1 edits source data only. Runtime/revision mapping remains Phase 4F work.

## JSON preservation

CMS merges known theme keys into the existing JSON object. Unknown/future
theme keys are preserved instead of replacing the entire object.
