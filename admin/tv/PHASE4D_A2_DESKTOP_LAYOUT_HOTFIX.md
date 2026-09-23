# MJHK TV Phase 4D-A2 — Desktop Layout Hotfix

## Root cause

Runtime diagnostics showed:

```text
.admin-shell
display: block
width: 250

.sidebar
width: 250
height: 1146

main.content
width: 250
x: 0
y: 1146
```

Therefore the main content was not placed beside the sidebar.

At narrow viewport widths, the content became visible only after scrolling below
the sidebar, which made the issue look viewport-dependent.

## Fix

For desktop only:

```text
.admin-shell
→ CSS Grid
→ 250px sidebar
→ remaining width content
```

No JavaScript change.
No Supabase change.
No CMS CRUD change.
No revision/publish change.
