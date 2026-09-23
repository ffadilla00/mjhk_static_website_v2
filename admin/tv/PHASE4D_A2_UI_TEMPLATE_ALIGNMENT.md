# Phase 4D-A2 — UI Template Alignment Hotfix

Dedicated Screens originally used a custom shell introduced in A2.

Existing TV CMS pages use:

```text
admin-shell
sidebar
menu
content
topbar
```

This hotfix rebuilds `admin/tv-dedicated-screens.html` around that existing
shell and keeps the Dedicated Screens CRUD/dialog JavaScript untouched.

No Supabase mutation.
No schema migration.
No revision publish.
No player change.
